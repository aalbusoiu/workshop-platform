import type { Prisma, PrismaClient, SessionStatus } from '@prisma/client';
import { nextId } from './factory-ids';

// Rotating join-code prefixes keep generated codes readable and unique across builds.
const JOIN_CODE_PREFIXES = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO'];
// Mirrors the repository’s default while still letting tests raise/lower capacity.
const DEFAULT_MAX_PARTICIPANTS = 5;
const DEFAULT_CREATED_AT = new Date('2025-01-01T00:00:00.000Z');

export type SessionFactoryOverrides = Partial<Prisma.WorkshopSessionCreateInput> & {
  createdById?: number;
  status?: SessionStatus;
  maxParticipants?: number;
  code?: string;
  createdAt?: Date;
  participants?: Prisma.ParticipantCreateNestedManyWithoutSessionInput;
};

// Turns the current factory sequence into a predictable join code like ALPHA1001.
const buildJoinCode = (sequence: number): string => {
  const prefix = JOIN_CODE_PREFIXES[(sequence - 1) % JOIN_CODE_PREFIXES.length];
  return `${prefix}${(1000 + sequence).toString()}`;
};

// Creates a WorkshopSession payload that matches the repository contract: we default to an inline
// owner (for self-contained tests) but honour createdById when the caller already seeded a user.
// Optional nested participants allow tests to pre-load attendees, matching service behaviour.
export const buildSessionCreateInput = (
  overrides: SessionFactoryOverrides = {},
): Prisma.WorkshopSessionCreateInput => {
  const sequence = nextId();
  const {
    createdById,
    createdBy,
    participants,
    code,
    status,
    maxParticipants,
    createdAt,
    ...nestedOverrides
  } = overrides;

  const baseCreatedBy =
    createdBy ??
    (createdById
      ? { connect: { id: createdById } }
      : {
          create: {
            email: `factory-user-${sequence}@example.com`,
            passwordHash: `factory-hash-${sequence}`,
            role: 'RESEARCHER',
          },
        });

  const base: Prisma.WorkshopSessionCreateInput = {
    code: code ?? buildJoinCode(sequence),
    status: status ?? 'LOBBY',
    maxParticipants: maxParticipants ?? DEFAULT_MAX_PARTICIPANTS,
    createdAt: createdAt ?? DEFAULT_CREATED_AT,
    createdBy: baseCreatedBy,
    ...(participants ? { participants } : {}),
  };

  return {
    ...base,
    ...nestedOverrides,
    createdBy: baseCreatedBy,
  };
};

// Persists a WorkshopSession using Prisma so specs can grab a ready-to-use session in one call.
export const createSession = async (
  prisma: PrismaClient,
  overrides: SessionFactoryOverrides = {},
  args: Omit<Prisma.WorkshopSessionCreateArgs, 'data'> = {},
) => {
  return prisma.workshopSession.create({
    ...args,
    data: buildSessionCreateInput(overrides),
  });
};
