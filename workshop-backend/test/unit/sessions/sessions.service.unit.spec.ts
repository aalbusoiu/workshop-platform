import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SessionsService } from '../../../src/sessions/sessions.service';
import { SessionsRepository } from '../../../src/sessions/sessions.repository';
import { ParticipantsService } from '../../../src/participants/participants.service';
import { generateSessionCode } from '../../../src/common/util/session-code';
import { SessionStatus, UserRole } from '@prisma/client';

jest.mock('../../../src/common/util/session-code', () => ({
  generateSessionCode: jest.fn(),
}));

type RepositoryMock = jest.Mocked<
  Pick<
    SessionsRepository,
    | 'createSession'
    | 'isUniqueConstraintError'
    | 'findByCode'
    | 'updateSessionStatus'
    | 'findSessionById'
    | 'findSessionForOwnerCheck'
  >
>;

type ParticipantsMock = jest.Mocked<
  Pick<
    ParticipantsService,
    'joinSession' | 'getSessionParticipants' | 'leaveSession'
  >
>;


/**
 * Unit tests for SessionsService covering session creation, joining, status updates, leaving, and access checks.
 * Repository and participants dependencies are mocked so individual control-flow branches can be exercised.
 */
describe('SessionsService', () => {
  let service: SessionsService;
  let repository: RepositoryMock;
  let participants: ParticipantsMock;

  // Reset repository/participant mocks and set a deterministic session-code before each test run.
  beforeEach(() => {
    jest.resetAllMocks();

    repository = {
      createSession: jest.fn(),
      isUniqueConstraintError: jest.fn(),
      findByCode: jest.fn(),
      updateSessionStatus: jest.fn(),
      findSessionById: jest.fn(),
      findSessionForOwnerCheck: jest.fn(),
    };

    participants = {
      joinSession: jest.fn(),
      getSessionParticipants: jest.fn(),
      leaveSession: jest.fn(),
    };

    (generateSessionCode as jest.Mock).mockReturnValue('ABCDE');

    service = new SessionsService(
      repository as unknown as SessionsRepository,
      participants as unknown as ParticipantsService,
    );
  });

  describe('createSession', () => {
    
    /**
     * Confirms createSession generates a code, persists the session, and returns the mapped DTO.
     * The repository mock is inspected to ensure it was called with the expected payload.
     */
    it('creates a session with generated join code and default status', async () => {
      const createdAt = new Date('2025-01-01T00:00:00Z');

      repository.createSession.mockResolvedValue({
        id: 1,
        code: 'ABCDE',
        status: SessionStatus.LOBBY,
        maxParticipants: 5,
        createdAt,
      } as never);

      const result = await service.createSession(42, { maxParticipants: 5 });

      expect(generateSessionCode).toHaveBeenCalledTimes(1);
      expect(repository.createSession).toHaveBeenCalledWith({
        code: 'ABCDE',
        createdById: 42,
        maxParticipants: 5,
      });
      expect(result).toEqual({
        id: 1,
        code: 'ABCDE',
        status: SessionStatus.LOBBY,
        maxParticipants: 5,
        createdAt,
      });
    });

    /**
     * Ensures collisions trigger retries with new codes until the repository accepts one.
     * The-generated codes are stubbed to collide once and then succeed.
     */
    it('retries when the generated code collides and eventually succeeds', async () => {
      const collisionError = new Error('duplicate');
      (generateSessionCode as jest.Mock)
        .mockReturnValueOnce('ABCDE')
        .mockReturnValueOnce('FGHIJ');

      repository.createSession
        .mockRejectedValueOnce(collisionError)
        .mockResolvedValueOnce({
          id: 2,
          code: 'FGHIJ',
          status: SessionStatus.LOBBY,
          maxParticipants: 4,
          createdAt: new Date('2025-01-02T00:00:00Z'),
        } as never);

      repository.isUniqueConstraintError.mockImplementation(
        (err) => err === collisionError,
      );

      const result = await service.createSession(99, { maxParticipants: 4 });

      expect(generateSessionCode).toHaveBeenCalledTimes(2);
      expect(repository.createSession).toHaveBeenNthCalledWith(1, {
        code: 'ABCDE',
        createdById: 99,
        maxParticipants: 4,
      });
      expect(repository.createSession).toHaveBeenNthCalledWith(2, {
        code: 'FGHIJ',
        createdById: 99,
        maxParticipants: 4,
      });
      expect(result.code).toBe('FGHIJ');
    });

    /**
     * Confirms non-unique errors bubble up unchecked.
     * The repository mock throws an unexpected error which should propagate to the caller.
     */
    it('bubbles non-collision errors from the repository', async () => {
      const unexpected = new Error('boom');
      repository.createSession.mockRejectedValueOnce(unexpected);
      repository.isUniqueConstraintError.mockReturnValue(false);

      await expect(
        service.createSession(1, { maxParticipants: 5 }),
      ).rejects.toThrow(unexpected);
      expect(generateSessionCode).toHaveBeenCalledTimes(1);
    });

    /**
     * Verifies the retry loop aborts after five collisions and raises ConflictException.
     * The repository mock keeps returning a collision until the service fails.
     */
    it('throws ConflictException after exhausting all retries', async () => {
      const collisionError = new Error('duplicate');
      (generateSessionCode as jest.Mock).mockReturnValue('ABCDE');

      repository.createSession.mockRejectedValue(collisionError);
      repository.isUniqueConstraintError.mockReturnValue(true);

      await expect(
        service.createSession(1, { maxParticipants: 5 }),
      ).rejects.toThrow(ConflictException);
      expect(repository.createSession).toHaveBeenCalledTimes(5);
    });
  });

describe('joinByCode', () => {

    /**
     * Verifies joinByCode loads the session, delegates to ParticipantsService, and maps the result DTO.
     * The expiresAt field is returned as an ISO string to match the controller contract.
     */
    it('joins a lobby session and maps participant/token response', async () => {
      const session = {
        id: 10,
        code: 'ABCDE',
        status: SessionStatus.LOBBY,
        maxParticipants: 5,
        createdById: 1,
        createdAt: new Date('2025-01-01T00:00:00Z'),
      };
      repository.findByCode.mockResolvedValue(session as never);

      const expiresAt = new Date('2025-01-02T00:00:00Z');
      participants.joinSession.mockResolvedValue({
        participant: {
          id: 99,
          displayName: 'Participant 1',
          colorHex: '#FFFFFF',
          joinedAt: new Date('2025-01-01T01:00:00Z'),
          sessionId: 10,
        },
        token: 'signed-token',
        expiresAt,
      });

      const result = await service.joinByCode({
        code: 'ABCDE',
        displayName: 'Participant 1',
        colorHex: '#FFFFFF',
      });

      expect(participants.joinSession).toHaveBeenCalledWith(session, {
        code: 'ABCDE',
        displayName: 'Participant 1',
        colorHex: '#FFFFFF',
      });
      expect(result).toEqual({
        token: 'signed-token',
        participantId: 99,
        sessionId: 10,
        code: 'ABCDE',
        displayName: 'Participant 1',
        expiresAt: expiresAt.toISOString(),
      });
    });

    /**
     * Ensures NotFoundException is thrown when no session matches the code.
     * ParticipantsService must not be invoked for unknown sessions.
     */
    it('throws NotFoundException when session code is unknown', async () => {
      repository.findByCode.mockResolvedValue(null);

      await expect(
        service.joinByCode({
          code: 'ZZZZZ',
          displayName: 'Ghost',
          colorHex: '#000000',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(participants.joinSession).not.toHaveBeenCalled();
    });

    /**
     * Confirms sessions outside the lobby state reject join requests.
     * Repository returns a running session, causing ForbiddenException.
     */
    it('throws ForbiddenException when session is not accepting participants', async () => {
      repository.findByCode.mockResolvedValue({
        id: 1,
        code: 'ABCDE',
        status: SessionStatus.RUNNING,
        maxParticipants: 5,
        createdById: 1,
        createdAt: new Date('2025-01-01T00:00:00Z'),
      } as never);

      await expect(
        service.joinByCode({
          code: 'ABCDE',
          displayName: 'Latecomer',
          colorHex: '#000000',
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(participants.joinSession).not.toHaveBeenCalled();
    });
  });

  describe('updateSessionStatus', () => {
    /**
     * Validates owners can promote a lobby session to running.
     * Both the ownership check and the update call should be triggered.
     */
    it('updates status when requester owns the session and transition is valid', async () => {
      repository.findSessionForOwnerCheck.mockResolvedValue({
        id: 1,
        status: SessionStatus.LOBBY,
      } as never);

      repository.updateSessionStatus.mockResolvedValue({
        id: 1,
        status: SessionStatus.RUNNING,
      } as never);

      const result = await service.updateSessionStatus(
        1,
        SessionStatus.RUNNING,
        42,
      );

      expect(repository.findSessionForOwnerCheck).toHaveBeenCalledWith(1, 42);
      expect(repository.updateSessionStatus).toHaveBeenCalledWith(
        1,
        SessionStatus.RUNNING,
      );
      expect(result).toEqual({
        id: 1,
        status: SessionStatus.RUNNING,
      });
    });

    /**
     * Ensures non-owners receive NotFoundException to avoid leaking session existence.
     * No update call should be performed.
     */
    it('throws NotFoundException when user does not own the session', async () => {
      repository.findSessionForOwnerCheck.mockResolvedValue(null);

      await expect(
        service.updateSessionStatus(1, SessionStatus.RUNNING, 999),
      ).rejects.toThrow(NotFoundException);

      expect(repository.updateSessionStatus).not.toHaveBeenCalled();
    });

    /**
     * Confirms invalid status transitions are prevented before hitting the repository.
     * A running session should not return to lobby.
     */
    it('throws ForbiddenException for invalid status transition', async () => {
      repository.findSessionForOwnerCheck.mockResolvedValue({
        id: 1,
        status: SessionStatus.RUNNING,
      } as never);

      await expect(
        service.updateSessionStatus(1, SessionStatus.LOBBY, 42),
      ).rejects.toThrow(ForbiddenException);

      expect(repository.updateSessionStatus).not.toHaveBeenCalled();
    });

    [
      { from: SessionStatus.LOBBY, to: SessionStatus.ABANDONED },
      { from: SessionStatus.RUNNING, to: SessionStatus.ENDED },
      { from: SessionStatus.RUNNING, to: SessionStatus.ABANDONED },
    ].forEach(({ from, to }) => {
      it(`allows transition from ${from} to ${to}`, async () => {
        repository.findSessionForOwnerCheck.mockResolvedValue({
          id: 1,
          status: from,
        } as never);

        repository.updateSessionStatus.mockResolvedValue({
          id: 1,
          status: to,
        } as never);

        const result = await service.updateSessionStatus(1, to, 42);

        expect(repository.findSessionForOwnerCheck).toHaveBeenCalledWith(1, 42);
        expect(repository.updateSessionStatus).toHaveBeenCalledWith(1, to);
        expect(result).toEqual({ id: 1, status: to });
      });
    });

    [SessionStatus.ENDED, SessionStatus.ABANDONED].forEach((from) => {
      /**
       * Ensures terminal statuses block any further transitions.
       * Both ENDED and ABANDONED should reject new status requests.
       */
      it(`rejects transitions when current status is ${from}`, async () => {
        repository.findSessionForOwnerCheck.mockResolvedValue({
          id: 1,
          status: from,
        } as never);

        await expect(
          service.updateSessionStatus(1, SessionStatus.LOBBY, 42),
        ).rejects.toThrow(ForbiddenException);

        expect(repository.updateSessionStatus).not.toHaveBeenCalled();
      });
    });

  });

  describe('leaveSession', () => {

    /**
     * Checks that leaveSession delegates to ParticipantsService when the session is in lobby.
     * The repository finds the session first, then the participants service handles the leave.
     */
    it('delegates to ParticipantsService when session is in lobby', async () => {
      repository.findSessionById.mockResolvedValue({
        id: 1,
        status: SessionStatus.LOBBY,
        maxParticipants: 5,
        createdById: 7,
        createdAt: new Date('2025-01-01T00:00:00Z'),
      } as never);

      await service.leaveSession(1, 'token-value');

      expect(repository.findSessionById).toHaveBeenCalledWith(1);
      expect(participants.leaveSession).toHaveBeenCalledWith(1, 'token-value');
    });


    /**
     * Ensures leave requests are rejected once the session leaves the lobby state.
     * No calls to ParticipantsService should happen when the session is running.
     */
    it('throws ForbiddenException when session is missing or not lobby', async () => {
      repository.findSessionById.mockResolvedValue({
        id: 1,
        status: SessionStatus.RUNNING,
        maxParticipants: 5,
        createdById: 7,
        createdAt: new Date('2025-01-01T00:00:00Z'),
      } as never);

      await expect(service.leaveSession(1, 'token')).rejects.toThrow(
        ForbiddenException,
      );

      expect(participants.leaveSession).not.toHaveBeenCalled();
    });
  });

  describe('getSessionDetails', () => {

    /**
     * Confirms owners receive the detailed session DTO, including participant count and creator info.
     * The repository response is mapped to the shape expected by controllers.
     */
    it('returns session details for the owner', async () => {
      const createdAt = new Date('2025-01-01T00:00:00Z');
      repository.findSessionById.mockResolvedValue({
      id: 11,
      code: 'ABCDE',
      status: SessionStatus.LOBBY,
      maxParticipants: 5,
      createdAt,
      createdById: 42,
      createdBy: { id: 42, email: 'owner@example.com', role: UserRole.MODERATOR },
      _count: { participants: 3 },
      } as never);
      
      const result = await service.getSessionDetails(11, 42, UserRole.MODERATOR);
      expect(repository.findSessionById).toHaveBeenCalledWith(11);
      expect(result).toEqual({
        id: 11,
        code: 'ABCDE',
        status: SessionStatus.LOBBY,
        maxParticipants: 5,
        participantCount: 3,
        createdAt,
        createdBy: { id: 42, email: 'owner@example.com', role: UserRole.MODERATOR },
      });
    });

    /**
     * Ensures NotFoundException is raised when no session exists for the provided ID.
     * No further processing is performed in this case.
     */
    it('throws NotFoundException when session is missing', async () => {
      repository.findSessionById.mockResolvedValue(null);

      await expect(
        service.getSessionDetails(11, 42, UserRole.MODERATOR),
      ).rejects.toThrow(NotFoundException);
    });

    /**
     * Verifies non-owners without elevated roles are blocked from viewing session details.
     * The repository returns a valid session, but the caller lacks sufficient rights.
     */
    it('throws ForbiddenException when user lacks access', async () => {
      repository.findSessionById.mockResolvedValue({
        id: 11,
        code: 'ABCDE',
        status: SessionStatus.LOBBY,
        maxParticipants: 5,
        createdAt: new Date(),
        createdById: 7,
        createdBy: { id: 7, email: 'owner@example.com', role: UserRole.MODERATOR },
        _count: { participants: 2 },
      } as never);

      await expect(
        service.getSessionDetails(11, 99, UserRole.MODERATOR),
      ).rejects.toThrow(ForbiddenException);
    });
  });


  describe('getSessionParticipants', () => {
    /**
     * Confirms owners receive the participant list from the participants service.
     * The service simply forwards the repository result when access is granted.
     */
    it('returns participants when the caller owns the session', async () => {
      repository.findSessionById.mockResolvedValue({
        id: 11,
        createdById: 42,
      } as never);
      const joinedAt = new Date('2025-01-01T12:00:00Z');
      participants.getSessionParticipants.mockResolvedValue([
        { id: 1, displayName: 'Alice', colorHex: '#FFAA00', joinedAt },
      ]);

      const result = await service.getSessionParticipants(11, 42, UserRole.MODERATOR);

      expect(repository.findSessionById).toHaveBeenCalledWith(11);
      expect(participants.getSessionParticipants).toHaveBeenCalledWith(11);
      expect(result).toEqual([
        { id: 1, displayName: 'Alice', colorHex: '#FFAA00', joinedAt },
      ]);
    });

    /**
     * Validates admins can view participant lists even if they are not the creator.
     * No ownership check is required beyond confirm the session exists.
     */
    it('allows admins to view participants even when they do not own the session', async () => {
      repository.findSessionById.mockResolvedValue({
        id: 11,
        createdById: 7,
      } as never);
      participants.getSessionParticipants.mockResolvedValue([]);

      await service.getSessionParticipants(11, 99, UserRole.ADMIN);

      expect(participants.getSessionParticipants).toHaveBeenCalledWith(11);
    });

    /**
     * Ensures NotFoundException is thrown for missing sessions before hitting participants service.
     * The participants service should not be invoked when the session lookup fails.
     */
    it('throws NotFoundException when the session does not exist', async () => {
      repository.findSessionById.mockResolvedValue(null);

      await expect(
        service.getSessionParticipants(11, 42, UserRole.MODERATOR),
      ).rejects.toThrow(NotFoundException);

      expect(participants.getSessionParticipants).not.toHaveBeenCalled();
    });

    /**
     * Confirms users without appropriate access are blocked from viewing participants.
     * The repository returns a session owned by someone else, so ForbiddenException is thrown.
     */
    it('throws ForbiddenException when caller lacks access', async () => {
      repository.findSessionById.mockResolvedValue({
        id: 11,
        createdById: 7,
      } as never);

      await expect(
        service.getSessionParticipants(11, 42, UserRole.MODERATOR),
      ).rejects.toThrow(ForbiddenException);

      expect(participants.getSessionParticipants).not.toHaveBeenCalled();
    });
  });



  type RepoMock = {
    findSessionForOwnerCheck: jest.Mock;
    withTransaction: jest.Mock;
    revokeAllParticipantTokens: jest.Mock;
    deleteAllParticipants: jest.Mock;
    deleteAllBmcDrafts: jest.Mock;
    deleteSessionRow: jest.Mock;
    updateSessionStatusTx: jest.Mock;
  };
   
  describe('SessionsService.deleteOrAbandonSession (unit)', () => {
    let repo: RepoMock;
    let service: SessionsService;

    const txSentinel = { tx: true } as any;

    beforeEach(() => {
      repo = {
        findSessionForOwnerCheck: jest.fn(),
        withTransaction: jest.fn(async (fn: any) => fn(txSentinel)),
        revokeAllParticipantTokens: jest.fn(async () => {}),
        deleteAllParticipants: jest.fn(async () => {}),
        deleteAllBmcDrafts: jest.fn(async () => {}),
        deleteSessionRow: jest.fn(async () => {}),
        updateSessionStatusTx: jest.fn(async () => {}),
      };

      // participantsService is not used by this method; pass a stub
      service = new (SessionsService as any)(repo, {});
    });

    it('throws NotFoundException when session not owned or not found', async () => {
      repo.findSessionForOwnerCheck.mockResolvedValue(null);

      await expect(service.deleteOrAbandonSession(1, 999)).rejects.toBeInstanceOf(NotFoundException);

      expect(repo.findSessionForOwnerCheck).toHaveBeenCalledWith(1, 999);
      expect(repo.withTransaction).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException for ENDED', async () => {
      repo.findSessionForOwnerCheck.mockResolvedValue({ id: 1, status: SessionStatus.ENDED });

      await expect(service.deleteOrAbandonSession(1, 2)).rejects.toBeInstanceOf(ForbiddenException);

      expect(repo.withTransaction).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException for ABANDONED', async () => {
      repo.findSessionForOwnerCheck.mockResolvedValue({ id: 1, status: SessionStatus.ABANDONED });

      await expect(service.deleteOrAbandonSession(1, 2)).rejects.toBeInstanceOf(ForbiddenException);

      expect(repo.withTransaction).not.toHaveBeenCalled();
    });

    it('LOBBY: revokes tokens, deletes participants and drafts, then deletes session row', async () => {
      repo.findSessionForOwnerCheck.mockResolvedValue({ id: 7, status: SessionStatus.LOBBY });

      await expect(service.deleteOrAbandonSession(7, 42)).resolves.toBeUndefined();

      expect(repo.withTransaction).toHaveBeenCalledTimes(1);
      expect(repo.deleteAllParticipants).toHaveBeenCalledWith(7, txSentinel);
      expect(repo.deleteAllBmcDrafts).toHaveBeenCalledWith(7, txSentinel);
      expect(repo.deleteSessionRow).toHaveBeenCalledWith(7, txSentinel);
      expect(repo.updateSessionStatusTx).not.toHaveBeenCalled();
    });

    it('RUNNING: revokes tokens, deletes participants, marks session ABANDONED (keeps data)', async () => {
      repo.findSessionForOwnerCheck.mockResolvedValue({ id: 9, status: SessionStatus.RUNNING });

      await expect(service.deleteOrAbandonSession(9, 77)).resolves.toBeUndefined();

      expect(repo.withTransaction).toHaveBeenCalledTimes(1);
      expect(repo.deleteAllParticipants).toHaveBeenCalledWith(9, txSentinel);
      expect(repo.updateSessionStatusTx).toHaveBeenCalledWith(9, SessionStatus.ABANDONED, txSentinel);
      expect(repo.deleteAllBmcDrafts).not.toHaveBeenCalled();
      expect(repo.deleteSessionRow).not.toHaveBeenCalled();
    });

    it('propagates errors from within the transaction (rollback scenario)', async () => {
      repo.findSessionForOwnerCheck.mockResolvedValue({ id: 5, status: SessionStatus.LOBBY });
      repo.deleteAllParticipants.mockRejectedValue(new Error('boom'));

      await expect(service.deleteOrAbandonSession(5, 1)).rejects.toThrow('boom');

      expect(repo.withTransaction).toHaveBeenCalledTimes(1);
    });
  });



});