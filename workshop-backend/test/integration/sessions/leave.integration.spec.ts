import { SessionStatus } from '@prisma/client';
import { createTestingApp, destroyTestingApp, resetDatabase } from '../../utils/app-test';
import { seedLobbySession } from '../../utils/test-seed';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { generateSessionCode } from '../../../src/common/util/session-code';


jest.setTimeout(60000); // allow enough time for the image pull / container start


/**
 * This suite drives POST /sessions/leave against the live Nest app and database.
 * Each test joins participants through the public endpoint, calls the leave route, and verifies the resulting state.
 */
describe('POST /sessions/leave (integration)', () => {
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

  const joinSessionViaPublicEndpoint = async (
    sessionId: number,
    overrides: { displayName?: string; colorHex?: string } = {},
  ) => {
    const code = await assignJoinableCode(sessionId);

    const response = await http
      .post('/sessions/join')
      .send({
        code,
        displayName: overrides.displayName ?? 'Participant',
        colorHex: overrides.colorHex ?? '#AA5500',
      })
      .expect(200);

    return {
      token: response.body.token,
      participantId: response.body.participantId,
    };
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
   * Confirms a participant can leave using the raw token issued by /sessions/join.
   * After leaving we check that both the participant record and the token record have been removed.
   */
 it('allows a participant to leave using the raw token issued by /sessions/join', async () => {
    const { session } = await seedLobbySession({ participantCount: 0 });
    const { token, participantId } = await joinSessionViaPublicEndpoint(session.id, {
      displayName: 'Kennedy',
      colorHex: '#AA5500',
    });

    await http
      .post(`/sessions/${session.id}/leave`)
      .send({ token })
      .expect(201);

    const remainingParticipant = await prisma.participant.findUnique({
      where: { id: participantId },
    });
    expect(remainingParticipant).toBeNull();

    const tokenRecord = await prisma.sessionToken.findFirst({
      where: { participantId },
    });
    expect(tokenRecord).toBeNull();
  });

  
  /**
   * Ensures leaving from a lobby session removes the participant row and any associated token.
   * We join once, call the leave route, and then verify neither record remains in Prisma.
   */
  it('removes participant and revokes token when session is in LOBBY', async () => {
    const { session } = await seedLobbySession({ participantCount: 0 });
    const { token, participantId } = await joinSessionViaPublicEndpoint(session.id, {
      displayName: 'Atlas',
      colorHex: '#BB6600',
    });

    await http
      .post(`/sessions/${session.id}/leave`)
      .send({ token })
      .expect(201);

    const participantExists = await prisma.participant.findUnique({
      where: { id: participantId },
    });
    expect(participantExists).toBeNull();

    const tokenRecord = await prisma.sessionToken.findFirst({
      where: { participantId },
    });
    expect(tokenRecord).toBeNull();
  });

  
  /**
   * Verifies the endpoint refuses leave requests once the session has moved out of LOBBY.
   * After switching the session to RUNNING, a leave attempt should return HTTP 403.
   */
  it('rejects leave when session is not in LOBBY', async () => {
    const { session } = await seedLobbySession({ participantCount: 0 });
    const { token } = await joinSessionViaPublicEndpoint(session.id);

    await prisma.workshopSession.update({
      where: { id: session.id },
      data: { status: SessionStatus.RUNNING },
    });

    await http
      .post(`/sessions/${session.id}/leave`)
      .send({ token })
      .expect(403);
  });

  /**
   * Checks that clearly invalid tokens are rejected with HTTP 403.
   * The test sends a fake JWT-like string and expects the request to be denied.
   */
  it('rejects leave when token is invalid', async () => {
    const { session } = await seedLobbySession({ participantCount: 0 });

    await http
      .post(`/sessions/${session.id}/leave`)
      .send({ token: 'aaa.bbb.ccc' })
      .expect(403);
  });

  /**
   * Makes sure the controller enforces DTO validation by requiring the token field.
   * Submitting an empty body produces a 400 response and leaves the participant count unchanged.
   */
  it('returns 400 when the token is omitted from the payload', async () => {
    const { session } = await seedLobbySession({ participantCount: 0 });

    await http.post(`/sessions/${session.id}/leave`).send({}).expect(400);

    const participantCount = await prisma.participant.count({
      where: { sessionId: session.id },
    });
    expect(participantCount).toBe(0);
  });

  /**
   * Confirms a token cannot be reused after the participant has already left.
   * The second leave request with the same token should fail with HTTP 403.
   */
  it('rejects a second leave request with the same token once the participant is removed', async () => {
    const { session } = await seedLobbySession({ participantCount: 0 });
    const { token } = await joinSessionViaPublicEndpoint(session.id, {
      displayName: 'Nova',
      colorHex: '#00AAFF',
    });

    await http
      .post(`/sessions/${session.id}/leave`)
      .send({ token })
      .expect(201);

    await http
      .post(`/sessions/${session.id}/leave`)
      .send({ token })
      .expect(403);
  });

  /**
   * Ensures leaving wipes the stored token so it cannot be presented again.
   * After we confirm the token row is gone, a second leave attempt with the same token should be rejected.
   */
   it('marks the session token as revoked so it cannot be reused', async () => {
    const { session } = await seedLobbySession({ participantCount: 0 });
    const { token, participantId } = await joinSessionViaPublicEndpoint(session.id, {
      displayName: 'Ray',
      colorHex: '#FF00FF',
    });

    await http
      .post(`/sessions/${session.id}/leave`)
      .send({ token })
      .expect(201);

    const tokenCount = await prisma.sessionToken.count({
      where: { participantId },
    });
    expect(tokenCount).toBe(0);

    await http
      .post(`/sessions/${session.id}/leave`)
      .send({ token })
      .expect(403);
  });
  
});
