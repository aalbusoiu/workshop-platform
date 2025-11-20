import { PrismaClient, SessionStatus } from '@prisma/client';
import { TestDatabaseContainer } from '../setup/testcontainers';
import { buildSessionCreateInput, createSession } from '../factories/session.factory';
import { buildParticipantCreateInput, createParticipant } from '../factories/participant.factory';
import { resetFactoryIds } from '../factories/factory-ids';

// Reusable helpers for seeding and cleaning the database during tests


// Shared Prisma client for test seeding utilities.

let prisma: PrismaClient | null = null;

const getPrisma = (): PrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: TestDatabaseContainer.getDatabaseUrl(),
        },
      },
    });
  }
  return prisma;
};
type SeedSessionOptions = {
  status?: SessionStatus;
  participantCount?: number;
};


// Clears all workshop-related tables and resets factory counters to keep tests isolated.
export const truncateTestData = async (): Promise<void> => {
  const client = getPrisma();
  await client.$transaction([
    client.sessionToken.deleteMany(),
    client.participant.deleteMany(),
    client.workshopSession.deleteMany(),
    client.user.deleteMany(),
  ]);
  resetFactoryIds();
};

// Creates a session (default LOBBY) with optional participants so integration tests start from a known state.
export const seedLobbySession = async (
  { status = SessionStatus.LOBBY, participantCount = 0 }: SeedSessionOptions = {},
) => {
  const client = getPrisma();
  resetFactoryIds();

  const session = await client.workshopSession.create({
    data: buildSessionCreateInput({ status }),
  });

  const participants = await Promise.all(
    Array.from({ length: participantCount }, (_, index) =>
      client.participant.create({
        data: buildParticipantCreateInput({
          displayName: `Participant ${index + 1}`,
          session: { connect: { id: session.id } },
        }),
      }),
    ),
  );

  return { session, participants };
};

// Ensures the Prisma client disconnects when tests finish to prevent open handles.
export const closePrismaConnections = async (): Promise<void> => {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
};