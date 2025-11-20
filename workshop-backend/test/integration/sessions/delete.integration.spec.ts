import { UserRole, SessionStatus, RoundStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  createTestingApp,
  destroyTestingApp,
  resetDatabase,
} from '../../utils/app-test';
import { PrismaService } from '../../../src/prisma/prisma.service';

jest.setTimeout(60000);

describe('DELETE /sessions/:id (integration)', () => {
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

  const seedModeratorAndLogin = async (email = 'moderator@example.com') => {
    const password = 'Sup3rSecret!';
    const passwordHash = await bcrypt.hash(password, 10);

    const moderator = await prisma.user.create({
      data: {
        email,
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

  it('deletes a LOBBY session (204) and removes participants, tokens, and BMC drafts', async () => {
    const { token, moderator } = await seedModeratorAndLogin();

    // Create session in LOBBY
    const { body: session } = await http
      .post('/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ maxParticipants: 5 })
      .expect(201);

    // Create a participant via join endpoint (only allowed in LOBBY)
    const join = await http
      .post('/sessions/join')
      .send({ code: session.code, colorHex: '#ff8800', displayName: 'Alice' })
      .expect(200);

    // Create an example BMC draft tied to the session
    await prisma.bmcProfile.create({
      data: {
        sessionId: session.id,
        payload: { draft: true },
      },
    });

    // Sanity: rows exist
    const before = await prisma.$transaction([
      prisma.participant.count({ where: { sessionId: session.id } }),
      prisma.sessionToken.count({
        where: { participant: { sessionId: session.id } },
      }),
      prisma.bmcProfile.count({ where: { sessionId: session.id } }),
      prisma.workshopSession.count({ where: { id: session.id } }),
    ]);
    expect(before).toEqual([1, 1, 1, 1]);

    // Delete the session
    await http
      .delete(`/sessions/${session.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    // Everything is gone (session, participants, tokens, bmc drafts)
    const after = await prisma.$transaction([
      prisma.participant.count({ where: { sessionId: session.id } }),
      prisma.sessionToken.count({
        where: { participant: { sessionId: session.id } },
      }),
      prisma.bmcProfile.count({ where: { sessionId: session.id } }),
      prisma.workshopSession.count({ where: { id: session.id } }),
    ]);
    expect(after).toEqual([0, 0, 0, 0]);
  });

  it('abandons a RUNNING session (204), removing participants and keeping BMC profiles and rounds', async () => {
    const { token } = await seedModeratorAndLogin();

    // Create session
    const { body: session } = await http
      .post('/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);

    // Promote to RUNNING
    await http
      .patch(`/sessions/${session.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: SessionStatus.RUNNING })
      .expect(200);

    // Add participant + token directly (join is not allowed in RUNNING)
    const participant = await prisma.participant.create({
      data: {
        sessionId: session.id,
        colorHex: '#00ccff',
        displayName: 'Bob',
      },
    });
    await prisma.sessionToken.create({
      data: {
        participantId: participant.id,
        tokenHash: 'dummyhash-running-1', // opaque in tests
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    // Create a Scenario and Round to ensure round data persists
    const scenario = await prisma.scenario.create({
      data: {
        title: 'Scenario A',
        description: 'Test scenario',
        payload: { v: 1 },
      },
    });
    await prisma.round.create({
      data: {
        sessionId: session.id,
        scenarioId: scenario.id,
        roundNumber: 1,
        status: RoundStatus.PLANNED,
      },
    });

    // Create a BMC profile that should be retained
    await prisma.bmcProfile.create({
      data: {
        sessionId: session.id,
        payload: { profile: 'keep' },
      },
    });

    // Sanity: rows exist
    const before = await prisma.$transaction([
      prisma.participant.count({ where: { sessionId: session.id } }),
      prisma.sessionToken.count({
        where: { participant: { sessionId: session.id } },
      }),
      prisma.bmcProfile.count({ where: { sessionId: session.id } }),
      prisma.round.count({ where: { sessionId: session.id } }),
    ]);
    expect(before).toEqual([1, 1, 1, 1]);

    // Delete (should ABANDON instead of deleting the session)
    await http
      .delete(`/sessions/${session.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);

    // Participants removed, tokens removed via cascade; session remains ABANDONED; BMC profiles and rounds remain
    const [participantsAfter, tokensAfter, bmcAfter, roundsAfter, persisted] =
      await prisma.$transaction([
        prisma.participant.count({ where: { sessionId: session.id } }),
        prisma.sessionToken.count({
          where: { participant: { sessionId: session.id } },
        }),
        prisma.bmcProfile.count({ where: { sessionId: session.id } }),
        prisma.round.count({ where: { sessionId: session.id } }),
        prisma.workshopSession.findUnique({ where: { id: session.id } }),
      ]);

    expect(participantsAfter).toBe(0);
    expect(tokensAfter).toBe(0);
    expect(bmcAfter).toBe(1);
    expect(roundsAfter).toBe(1);
    expect(persisted?.status).toBe(SessionStatus.ABANDONED);
  });

  it('forbids deleting ENDED and ABANDONED sessions (403)', async () => {
    const { token } = await seedModeratorAndLogin();

    // Create and move to RUNNING then ENDED
    const { body: session1 } = await http
      .post('/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);

    await http
      .patch(`/sessions/${session1.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: SessionStatus.RUNNING })
      .expect(200);

    await http
      .patch(`/sessions/${session1.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: SessionStatus.ENDED })
      .expect(200);

    await http
      .delete(`/sessions/${session1.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    // Create and immediately ABANDON from LOBBY
    const { body: session2 } = await http
      .post('/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);

    await http
      .patch(`/sessions/${session2.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: SessionStatus.ABANDONED })
      .expect(200);

    await http
      .delete(`/sessions/${session2.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('returns 404 when a different moderator (non-owner) attempts to delete', async () => {
    const owner = await seedModeratorAndLogin('owner@example.com');
    const other = await seedModeratorAndLogin('other@example.com');

    const { body: session } = await http
      .post('/sessions')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({})
      .expect(201);

    await http
      .delete(`/sessions/${session.id}`)
      .set('Authorization', `Bearer ${other.token}`)
      .expect(404);
  });
});