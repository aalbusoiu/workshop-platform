import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SessionsController } from '../../../src/sessions/sessions.controller';
import { SessionsService } from '../../../src/sessions/sessions.service';
import { CreateSessionDto } from '../../../src/sessions/dto/create.session.dto';
import { JoinSessionDto } from '../../../src/participants/dto/join.session.dto';
import { LeaveSessionDto } from '../../../src/participants/dto/leave.session.dto';
import { UpdateSessionStatusDto } from '../../../src/sessions/dto/update.session.status.dto';
import { SessionStatus, UserRole } from '@prisma/client';

const mockSessionsService = (): jest.Mocked<
  Pick<
    SessionsService,
    | 'createSession'
    | 'joinByCode'
    | 'leaveSession'
    | 'getSessionDetails'
    | 'updateSessionStatus'
  >
> => ({
  createSession: jest.fn(),
  joinByCode: jest.fn(),
  leaveSession: jest.fn(),
  getSessionDetails: jest.fn(),
  updateSessionStatus: jest.fn(),
});

/**
 * Unit tests for SessionsController with a mocked SessionsService.
 * Each suite exercises a controller method to ensure it forwards parameters and handles results correctly.
 */
describe('SessionsController', () => {
  let controller: SessionsController;
  let service: ReturnType<typeof mockSessionsService>;

  beforeEach(() => {
    service = mockSessionsService();
    controller = new SessionsController(service as unknown as SessionsService);
  });

  describe('create', () => {

    /**
     * Confirms the controller returns the session summary when the service succeeds.
     * It also checks that the authenticated user ID and DTO are passed through to the service.
     */
    it('returns the session summary when service succeeds', async () => {
      const dto = { maxParticipants: 12 } as CreateSessionDto;
      const req = { user: { id: 7 } } as any;

      service.createSession.mockResolvedValueOnce({
        id: 33,
        code: 'ABCDE',
        status: SessionStatus.LOBBY,
        maxParticipants: 12,
        createdAt: new Date('2025-01-01T10:00:00Z'),
      });

      const result = await controller.create(dto, req);

      expect(service.createSession).toHaveBeenCalledWith(7, dto);
      expect(result).toEqual({
        id: 33,
        code: 'ABCDE',
        status: SessionStatus.LOBBY,
        maxParticipants: 12,
        createdAt: new Date('2025-01-01T10:00:00Z'),
      });
    });

    /**
     * Ensures the controller throws NotFoundException when the service returns null.
     * The test passes a valid request and expects the controller to translate the null result into an error.
     */
    it('throws NotFoundException when service yields null', async () => {
      const req = { user: { id: 1 } } as any;

      service.createSession.mockResolvedValueOnce(null as any);

      await expect(
        controller.create({ maxParticipants: 5 } as CreateSessionDto, req),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('join', () => {
    
    /**
     * Verifies join returns only the public token payload fields.
     * The controller should call the service with the DTO and respond without leaking internal properties.
     */
    it('returns only token payload fields', async () => {
      const dto = {
        code: 'ABCDE',
        colorHex: '#00AAFF',
        displayName: 'Sky',
      } as JoinSessionDto;

      service.joinByCode.mockResolvedValueOnce({
        token: 'jwt-token',
        participantId: 10,
        sessionId: 99,
        code: 'ABCDE',
        displayName: 'Sky',
        expiresAt: new Date('2025-01-01T12:00:00Z').toISOString(),
      });

      const result = await controller.join(dto);

      expect(service.joinByCode).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        participantId: 10,
        sessionId: 99,
        token: 'jwt-token',
        expiresAt: new Date('2025-01-01T12:00:00Z').toISOString(),
      });
    });
  });

  describe('leaveSession', () => {

    /**
     * Checks that leaveSession forwards the session ID and token to the service.
     * The method itself returns void, so the test only asserts the service call parameters.
     */
    it('delegates to the service with params', async () => {
      const dto = { token: 'jwt-token' } as LeaveSessionDto;

      service.leaveSession.mockResolvedValueOnce(undefined);

      await controller.leaveSession(42, dto);

      expect(service.leaveSession).toHaveBeenCalledWith(42, 'jwt-token');
    });
    
  });

  describe('getSession', () => {

    /**
     * Confirms getSession passes the request context to the service and returns its result.
     * The test checks that the user ID and role are forwarded correctly.
     */
    it('fetches session details using request user context', async () => {
      const req = {
        user: { id: 5, role: UserRole.MODERATOR },
      } as any;

      service.getSessionDetails.mockResolvedValueOnce({
        id: 1,
        code: 'ABCDE',
      } as any);

      const result = await controller.getSession(1, req);

      expect(service.getSessionDetails).toHaveBeenCalledWith(
        1,
        5,
        UserRole.MODERATOR,
      );
      expect(result).toEqual({ id: 1, code: 'ABCDE' });
    });
  });

  describe('updateStatus', () => {

     /**
     * Ensures updateStatus forwards the session ID, new status, and user ID to the service.
     * It also checks that the controller returns the service response directly.
     */
    it('passes sessionId, status, and user id to service', async () => {
      const req = { user: { id: 8 } } as any;
      const dto = { status: SessionStatus.RUNNING } as UpdateSessionStatusDto;

      service.updateSessionStatus.mockResolvedValueOnce({
        id: 55,
        status: SessionStatus.RUNNING,
        code: 'ABCDE',
      });

      const result = await controller.updateStatus(55, dto, req);

      expect(service.updateSessionStatus).toHaveBeenCalledWith(
        55,
        SessionStatus.RUNNING,
        8,
      );
      expect(result).toEqual({
        id: 55,
        status: SessionStatus.RUNNING,
        code: 'ABCDE',
      });
    });
  });

describe('SessionsController.deleteSession (unit)', () => {
  let controller: SessionsController;
  let service: jest.Mocked<SessionsService>;

  const makeReq = (userId: number) =>
    ({ user: { id: userId, email: 'm@example.com', role: UserRole.MODERATOR } } as any);

  beforeEach(() => {
    service = {
      deleteOrAbandonSession: jest.fn(),
    } as any;

    controller = new SessionsController(service as any);
  });

  it('delegates to service with sessionId and owner user id', async () => {
    const req = makeReq(42);
    await expect(controller.deleteSession(7, req)).resolves.toBeUndefined();
    expect(service.deleteOrAbandonSession).toHaveBeenCalledWith(7, 42);
  });

  it('propagates NotFoundException from service', async () => {
    service.deleteOrAbandonSession.mockRejectedValue(new NotFoundException());
    await expect(controller.deleteSession(1, makeReq(2))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('propagates ForbiddenException from service', async () => {
    service.deleteOrAbandonSession.mockRejectedValue(new ForbiddenException());
    await expect(controller.deleteSession(1, makeReq(2))).rejects.toBeInstanceOf(ForbiddenException);
  });
});





});
