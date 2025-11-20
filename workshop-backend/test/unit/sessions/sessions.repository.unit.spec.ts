import { Prisma } from '@prisma/client';
import { SessionsRepository } from '../../../src/sessions/sessions.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { SessionStatus } from '@prisma/client';

const makePrismaMock = () =>
  ({
    workshopSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as jest.Mocked<PrismaService>);

/**
 * Unit tests for SessionsRepository verifying it forwards calls and shapes data correctly.
 * Each test uses a mocked PrismaService to assert the repository builds the right query payloads.
 */
describe('SessionsRepository', () => {
  let prisma: ReturnType<typeof makePrismaMock>;
  let repo: SessionsRepository;

  beforeEach(() => {
    prisma = makePrismaMock();
    repo = new SessionsRepository(prisma);
  });

  /**
   * Ensures createSession sets default status and passes through code, owner, and capacity.
   * The prisma.create mock is inspected to verify the payload.
   */
  it('createSession stores data with defaults', async () => {
    prisma.workshopSession.create.mockResolvedValueOnce({ id: 1 } as any);

    await repo.createSession({ code: 'ABCDE', createdById: 9, maxParticipants: 7 });

    expect(prisma.workshopSession.create).toHaveBeenCalledWith({
      data: {
        code: 'ABCDE',
        createdById: 9,
        maxParticipants: 7,
        status: SessionStatus.LOBBY,
      },
    });
  });

  /**
   * Verifies findByCode simply delegates to prisma.findUnique with the expected where clause.
   * The test also returns the mocked session to confirm the value is propagated back to the caller.
   */
  it('findByCode delegates to prisma', async () => {
    prisma.workshopSession.findUnique.mockResolvedValueOnce({ id: 5 } as any);

    const session = await repo.findByCode('ABCDE');

    expect(prisma.workshopSession.findUnique).toHaveBeenCalledWith({
      where: { code: 'ABCDE' },
    });
    expect(session).toEqual({ id: 5 });
  });

  /**
   * Confirms findSessionById requests participant counts and owner info.
   * The prisma mock is checked to ensure the include clause matches the repository contract.
   */
  it('findSessionById includes counts and owner info', async () => {
    prisma.workshopSession.findUnique.mockResolvedValueOnce(null);

    await repo.findSessionById(22);

    expect(prisma.workshopSession.findUnique).toHaveBeenCalledWith({
      where: { id: 22 },
      include: {
        _count: { select: { participants: true } },
        createdBy: { select: { id: true, email: true, role: true } },
      },
    });
  });

  /**
   * Ensures findSessionForOwnerCheck applies both ID and createdBy filters.
   * The generated where clause should match the composite lookup the service expects.
   */
  it('findSessionForOwnerCheck applies composite filters', async () => {
    prisma.workshopSession.findFirst.mockResolvedValueOnce({ id: 1 } as any);

    await repo.findSessionForOwnerCheck(3, 7);

    expect(prisma.workshopSession.findFirst).toHaveBeenCalledWith({
      where: { id: 3, createdById: 7 },
    });
  });

  /**
   * Verifies updateSessionStatus forwards the session ID and new status fields.
   * The prisma.update mock is used to confirm the repository builds the correct payload.
   */
  it('updateSessionStatus passes session id and new status', async () => {
    prisma.workshopSession.update.mockResolvedValueOnce({ id: 1 } as any);

    await repo.updateSessionStatus(11, SessionStatus.RUNNING);

    expect(prisma.workshopSession.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { status: SessionStatus.RUNNING },
    });
  });
  
  describe('isUniqueConstraintError', () => {

    /**
     * Checks that Prisma P2002 errors are detected as unique-constraint violations.
     * A fabricated PrismaClientKnownRequestError is passed to the helper.
     */
    it('returns true for Prisma P2002 errors', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '5.14.0',
        meta: { target: ['WorkshopSession_code_key'] }, // optional but clarifies intent
    });

    expect(repo.isUniqueConstraintError(error)).toBe(true);
    });

    /**
     * Ensures non-Prisma errors are not misidentified as unique-constraint issues.
     * A plain Error instance should return false.
     */
    it('returns false for other errors', () => {
      expect(repo.isUniqueConstraintError(new Error('boom'))).toBe(false);
    });
  });
});
 