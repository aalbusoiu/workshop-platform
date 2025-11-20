import { SessionStatus } from '@prisma/client';
import { createTestingApp, destroyTestingApp, resetDatabase } from '../../utils/app-test';
import { seedLobbySession } from '../../utils/test-seed';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { generateSessionCode } from '../../../src/common/util/session-code';


jest.setTimeout(60000); // allow enough time for the image pull / container start


/**
 * This suite runs POST /sessions/join end to end against the real Nest app and database.
 * Each test seeds data, issues a real HTTP request, and checks the response as well as any database side effects.
 */
describe('POST /sessions/join (integration)', () => {
  let app: Awaited<ReturnType<typeof createTestingApp>>['app'];
  let http: Awaited<ReturnType<typeof createTestingApp>>['http'];
  let prisma: PrismaService;

  const assignJoinableCode = async (sessionId: number) => {
    const code = generateSessionCode();
    await prisma.workshopSession.update({
      where: { id: sessionId },
      data: { code },
    });
    return code;
  };

  beforeAll(async () => {
    const boot = await createTestingApp();
    app = boot.app;
    http = boot.http;
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (app) {
      await prisma.$disconnect?.();
      await destroyTestingApp(app);
    }
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  /**
   * Confirms a lobby session accepts a join and returns token plus participant data.
   * The test seeds an empty session, hits POST /sessions/join, and asserts the response includes every public field.
   */
  it('joins a lobby session and returns token + participant details', async () => {
    const { session } = await seedLobbySession({ participantCount: 0 });
    const code = await assignJoinableCode(session.id);

    const response = await http
      .post('/sessions/join')
      .send({
        code,
        displayName: 'Alice',
        colorHex: '#FFAA00',
      })
      .expect(200);

    expect(response.body).toEqual({
      token: expect.any(String),
      participantId: expect.any(Number),
      sessionId: session.id,
      expiresAt: expect.any(String),
    });
  });

  /**
   * Ensures the join call persists the participant and its token in the database.
   * It compares participant counts before and after the request and checks Prisma to confirm the token row exists.
   */
  it('persists participant + token and keeps contract stable', async () => {
    const { session } = await seedLobbySession({ participantCount: 2 });
    const code = await assignJoinableCode(session.id);

    const beforeCount = await prisma.participant.count({
      where: { sessionId: session.id },
    });

    const response = await http
      .post('/sessions/join')
      .send({
        code,
        displayName: 'Bob',
        colorHex: '#FFAA00',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      token: expect.any(String),
      participantId: expect.any(Number),
      sessionId: session.id,
    });
    expect(typeof response.body.expiresAt).toBe('string');

    const afterCount = await prisma.participant.count({
      where: { sessionId: session.id },
    });
    expect(afterCount).toBe(beforeCount + 1);

    const tokenRecord = await prisma.sessionToken.findFirst({
      where: { participantId: response.body.participantId },
    });
    expect(tokenRecord).not.toBeNull();
  });

  /**
   * Verifies an unknown join code produces a 404 response.
   * The request uses a fake code and simply checks that the endpoint returns not found.
   */
  it('returns 404 when the join code does not exist', async () => {
    await http
      .post('/sessions/join')
      .send({
        code: 'ZZZZZ',
        displayName: 'Ghost',
        colorHex: '#000000',
      })
      .expect(404);
  });

  /**
   * Confirms only lobby sessions accept new participants.
   * A RUNNING session is seeded, its code reused, and the endpoint is expected to respond with 403.
   */
  it('returns 403 when the session status is not LOBBY', async () => {
    const { session } = await seedLobbySession({ status: SessionStatus.RUNNING });
    const code = await assignJoinableCode(session.id);

    await http
      .post('/sessions/join')
      .send({
        code,
        displayName: 'Latecomer',
        colorHex: '#123456',
      })
      .expect(403);
  });

  /**
   * Checks capacity rules by filling the session to its max and ensuring extra joins are blocked.
   * After pre-seeding the participant limit, the join attempt should be rejected with HTTP 403.
   */
  it('returns 403 when the session is already at capacity', async () => {
    const { session } = await seedLobbySession({ participantCount: 5 });
    const code = await assignJoinableCode(session.id);

    await http
      .post('/sessions/join')
      .send({
        code,
        displayName: 'Overflow',
        colorHex: '#ABCDEF',
      })
      .expect(403);
  });

  /**
   * Ensures DTO validation catches missing required data.
   * Omitting the session code should cause the validation pipe to return a 400 error.
   */
  it('enforces DTO validation (missing code triggers 400)', async () => {
    await http
      .post('/sessions/join')
      .send({
        displayName: 'Remy',
        colorHex: '#FF00FF',
      })
      .expect(400);
  });
});
