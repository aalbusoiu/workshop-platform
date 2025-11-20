import { ForbiddenException } from '@nestjs/common';
import { createHash } from 'crypto';
import { ParticipantsService } from '../../../src/participants/participants.service';
import { ParticipantsRepository } from '../../../src/participants/participants.repository';
import { signParticipantToken } from '../../../src/participants/participant-token';

jest.mock('../../../src/participants/participant-token', () => ({
  signParticipantToken: jest.fn(),
}));

type RepositoryMock = jest.Mocked<
  Pick<
    ParticipantsRepository,
    | 'withTransaction'
    | 'countParticipants'
    | 'createParticipant'
    | 'createSessionToken'
    | 'findParticipantByToken'
    | 'revokeSessionToken'
    | 'deleteParticipant'
    | 'getSessionParticipants'
  >
>;

const makeRepositoryMock = (): RepositoryMock => ({
  withTransaction: jest.fn(),
  countParticipants: jest.fn(),
  createParticipant: jest.fn(),
  createSessionToken: jest.fn(),
  findParticipantByToken: jest.fn(),
  revokeSessionToken: jest.fn(),
  deleteParticipant: jest.fn(),
  getSessionParticipants: jest.fn(),
});

/**
 * Unit tests for ParticipantsService covering join, list, and leave behaviours with a mocked repository.
 * Each suite targets one method and validates both the happy path and failure handling.
 */
describe('ParticipantsService', () => {
  let repository: RepositoryMock;
  let service: ParticipantsService;

  // Reset repository mocks and configure withTransaction to run callbacks with a dummy tx object.
  beforeEach(() => {
    jest.resetAllMocks();
    repository = makeRepositoryMock();
    repository.withTransaction.mockImplementation(async (callback) => {
      const tx = {} as any;
      return callback(tx);
    });
    service = new ParticipantsService(
      repository as unknown as ParticipantsRepository,
    );
  });

  describe('joinSession', () => {

    // Happy path
    /**
     * Ensures joinSession creates a participant, signs a token, and stores the token hash when capacity allows.
     * The repository mocks confirm each step of the transaction is called with the right arguments.
     */    it('creates participant and issues token when capacity allows', async () => {
      const session = {
        id: 10,
        code: 'ABCDE',
        status: 'LOBBY',
        maxParticipants: 5,
      };
      const dto = { displayName: 'Alice', colorHex: '#FFAA00', code: 'ABCDE' };

      repository.countParticipants.mockResolvedValueOnce(3);
      repository.createParticipant.mockResolvedValueOnce({
        id: 32,
        sessionId: 10,
        displayName: 'Alice',
        colorHex: '#FFAA00',
      } as any);
      const expiresAt = new Date('2025-01-03T12:00:00Z');
      (signParticipantToken as jest.Mock).mockReturnValue({
        token: 'raw-token',
        tokenHash: 'hashed-token',
        expiresAt,
      });

      repository.createSessionToken.mockResolvedValueOnce(undefined as any);

      const result = await service.joinSession(session, dto);

      expect(repository.withTransaction).toHaveBeenCalledTimes(1);
      expect(repository.countParticipants).toHaveBeenCalledWith(
        session.id,
        expect.anything(),
      );
      expect(repository.createParticipant).toHaveBeenCalledWith(
        {
          sessionId: 10,
          colorHex: '#FFAA00',
          displayName: 'Alice',
        },
        expect.anything(),
      );
      expect(signParticipantToken).toHaveBeenCalledWith({
        sessionId: 10,
        participantId: 32,
      });
      expect(repository.createSessionToken).toHaveBeenCalledWith(
        {
          participantId: 32,
          tokenHash: 'hashed-token',
          expiresAt,
        },
        expect.anything(),
      );
      expect(result).toEqual({
        participant: {
          id: 32,
          sessionId: 10,
          displayName: 'Alice',
          colorHex: '#FFAA00',
        },
        token: 'raw-token',
        expiresAt,
      });
    });

    /**
     * Verifies joinSession throws ForbiddenException when the session is full.
     * The repository should not attempt to create a participant or sign a token in this case.
     */    
    it('throws ForbiddenException when session is full', async () => {
      repository.countParticipants.mockResolvedValueOnce(5);

      await expect(
        service.joinSession(
          { id: 10, code: 'ABCDE', status: 'LOBBY', maxParticipants: 5 },
          { displayName: 'Bob', colorHex: '#123456', code: 'ABCDE' },
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(repository.createParticipant).not.toHaveBeenCalled();
      expect(signParticipantToken).not.toHaveBeenCalled();
    });
  });

  describe('getSessionParticipants', () => {

    /**
     * Confirms getSessionParticipants returns mapped DTOs rather than raw repository rows.
     * The mock repository provides data and the service should pass through only the relevant fields.
     */
    it('returns participants mapped to public view model', async () => {
      const joinedAt = new Date('2025-01-01T10:00:00Z');
      repository.getSessionParticipants.mockResolvedValueOnce([
        {
          id: 1,
          displayName: 'Alice',
          colorHex: '#FFAA00',
          joinedAt,
        },
      ] as any);

      const result = await service.getSessionParticipants(10);

      expect(repository.getSessionParticipants).toHaveBeenCalledWith(10);
      expect(result).toEqual([
        {
          id: 1,
          displayName: 'Alice',
          colorHex: '#FFAA00',
          joinedAt,
        },
      ]);
    });
  });

  describe('leaveSession', () => {

    /**
     * Checks leaveSession hashes the token, finds the matching participant, revokes the token, and deletes the participant.
     * All repository calls are asserted to prove the transaction took the correct actions.
     */
    it('revokes token and deletes participant when token is valid', async () => {
      const rawToken = 'raw-token';
      const expectedHash = createHash('sha256').update(rawToken).digest('hex');

      repository.findParticipantByToken.mockResolvedValueOnce({
        tokenHash: expectedHash,
        participant: { id: 77 },
      } as any);

      await service.leaveSession(10, rawToken);

      expect(repository.withTransaction).toHaveBeenCalledTimes(1);
      expect(repository.findParticipantByToken).toHaveBeenCalledWith(
        expectedHash,
        10,
        expect.anything(),
      );
      expect(repository.revokeSessionToken).toHaveBeenCalledWith(
        expectedHash,
        expect.anything(),
      );
      expect(repository.deleteParticipant).toHaveBeenCalledWith(
        77,
        expect.anything(),
      );
    });


    /**
     * Ensures leaveSession throws ForbiddenException when the token lookup fails.
     * Revocation and deletion must not run if the token is invalid or expired.
     */
    it('throws ForbiddenException when token is invalid or participant missing', async () => {
      repository.findParticipantByToken.mockResolvedValueOnce(null);

      await expect(service.leaveSession(10, 'bad-token')).rejects.toThrow(
        ForbiddenException,
      );

      expect(repository.revokeSessionToken).not.toHaveBeenCalled();
      expect(repository.deleteParticipant).not.toHaveBeenCalled();
    });

    /**
     * Verifies the service re-hashes tokens even when they already look like hashes.
     * The resulting hash should differ from the original input before revocation and deletion run.
     */
    it('still hashes the input when a 64-character value is provided', async () => {
      const prehashedLookingToken = 'a'.repeat(64);
      repository.findParticipantByToken.mockResolvedValueOnce({
        participant: { id: 5 },
      } as any);

      await service.leaveSession(10, prehashedLookingToken);

      const hashUsed = repository.findParticipantByToken.mock.calls[0][0];
      expect(hashUsed).toHaveLength(64);
      expect(hashUsed).not.toBe(prehashedLookingToken);

      expect(repository.revokeSessionToken).toHaveBeenCalledWith(
        hashUsed,
        expect.anything(),
      );
      expect(repository.deleteParticipant).toHaveBeenCalledWith(
        5,
        expect.anything(),
      );
    });

    /**
     * Confirms leaveSession rejects tokens that map to missing participant records.
     * ForbiddenException should be thrown and no repository write operations should follow.
     */
    it('throws ForbiddenException when token exists but participant record is missing', async () => {
      repository.findParticipantByToken.mockResolvedValueOnce({
        participant: null,
      } as any);

      await expect(service.leaveSession(10, 'raw-token')).rejects.toThrow(
        ForbiddenException,
      );

      expect(repository.revokeSessionToken).not.toHaveBeenCalled();
      expect(repository.deleteParticipant).not.toHaveBeenCalled();
    });
    
  });
});
