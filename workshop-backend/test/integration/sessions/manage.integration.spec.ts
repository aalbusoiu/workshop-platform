import { UserRole, SessionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  createTestingApp,
  destroyTestingApp,
  resetDatabase,
} from '../../utils/app-test';
import { PrismaService } from '../../../src/prisma/prisma.service';

jest.setTimeout(60000);

/**
 * This suite covers moderator-only session management flows end to end.
 * Each test logs in through the real auth stack and exercises the protected session routes.
 */
describe('Session management endpoints (integration)', () => {
  let app: Awaited<ReturnType<typeof createTestingApp>>['app'];
  let http: Awaited<ReturnType<typeof createTestingApp>>['http'];
  let prisma: PrismaService;

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

  const seedModeratorAndLogin = async () => {
    const password = 'Sup3rSecret!';
    const passwordHash = await bcrypt.hash(password, 10);

    const moderator = await prisma.user.create({
      data: {
        email: 'moderator@example.com',
        passwordHash,
        role: UserRole.MODERATOR,
      },
    });

    const loginResponse = await http
      .post('/auth/login')
      .send({ email: moderator.email, password })
      .expect(200);

    return {
      token: loginResponse.body.access_token as string,
      moderator,
    };
  };

  /**
   * Checks that an authenticated moderator can create a session through the protected endpoint.
   * The test logs in, calls POST /sessions with a bearer token, and verifies the new row belongs to that moderator.
   */
  it('allows a moderator to create a session', async () => {
    const { token, moderator } = await seedModeratorAndLogin();

    const response = await http
      .post('/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ maxParticipants: 12 })
      .expect(201);

    expect(response.body).toEqual({
      id: expect.any(Number),
      code: expect.any(String),
      status: SessionStatus.LOBBY,
      maxParticipants: 12,
      createdAt: expect.any(String),
    });

    const persisted = await prisma.workshopSession.findUnique({
      where: { id: response.body.id },
    });

    expect(persisted).toMatchObject({
      id: response.body.id,
      createdById: moderator.id,
      maxParticipants: 12,
      status: SessionStatus.LOBBY,
    });
  });
  
  /**
   * Ensures the same moderator can update the session status via PATCH /sessions/:id/status.
   * After creating it, we promote the session to RUNNING and confirm the change is persisted.
   */
  it('lets the owner promote a session to RUNNING', async () => {
    const { token } = await seedModeratorAndLogin();

    const createResponse = await http
      .post('/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);

    const sessionId = createResponse.body.id;

    const updateResponse = await http
      .patch(`/sessions/${sessionId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: SessionStatus.RUNNING })
      .expect(200);

    expect(updateResponse.body).toEqual({
      id: sessionId,
      status: SessionStatus.RUNNING,
      code: expect.any(String),
    });

    const updated = await prisma.workshopSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    expect(updated.status).toBe(SessionStatus.RUNNING);
  });
});
