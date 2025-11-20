import type { Prisma, PrismaClient } from '@prisma/client';
import { nextId } from './factory-ids';
import { buildSessionCreateInput } from './session.factory';

// Stable palette so colour assertions don’t flicker.
const PARTICIPANT_COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#1A535C', '#FF922B'];

// Keep timestamps deterministic unless a test overrides them.
const DEFAULT_JOINED_AT = new Date('2025-01-01T12:00:00.000Z');
const DEFAULT_TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours

export type ParticipantFactoryOverrides = Partial<Prisma.ParticipantCreateInput> & {
  sessionId?: number;
  colorHex?: string;
  displayName?: string;
  joinedAt?: Date;
  tokens?: Prisma.SessionTokenCreateNestedManyWithoutParticipantInput;
};

// Deterministic colour generator keyed off the factory sequence.
const pickColor = (sequence: number): string =>
  PARTICIPANT_COLORS[(sequence - 1) % PARTICIPANT_COLORS.length];

// Builds the Prisma payload so each participant gets a session and a token by default.
export const buildParticipantCreateInput = (
  overrides: ParticipantFactoryOverrides = {},
): Prisma.ParticipantCreateInput => {
  const sequence = nextId();
  const {
    session,
    sessionId,
    colorHex,
    displayName,
    joinedAt,
    tokens,
    ...nestedOverrides
  } = overrides;

  const effectiveJoinedAt = joinedAt ?? DEFAULT_JOINED_AT;

  // Attach to an existing session when a test supplies the ID; otherwise create one inline.
  const baseSession =
    session ??
    (sessionId
      ? { connect: { id: sessionId } }
      : { create: buildSessionCreateInput() });

  // Mimic the service by creating a single live session token unless tests override/disable it.
  const baseTokens =
    tokens ??
    {
      create: [
        {
          tokenHash: `factory-token-hash-${sequence}`,
          expiresAt: new Date(effectiveJoinedAt.getTime() + DEFAULT_TOKEN_LIFETIME_MS),
        },
      ],
    };

  const base: Prisma.ParticipantCreateInput = {
    displayName: displayName ?? `Participant ${sequence}`,
    colorHex: colorHex ?? pickColor(sequence),
    joinedAt: effectiveJoinedAt,
    session: baseSession,
    tokens: baseTokens,
  };

  return {
    ...base,
    ...nestedOverrides,
    session: session ?? base.session,
    tokens: tokens ?? base.tokens,
  };
};

// Convenience helper to persist the participant and return the Prisma result.
export const createParticipant = async (
  prisma: PrismaClient,
  overrides: ParticipantFactoryOverrides = {},
  args: Omit<Prisma.ParticipantCreateArgs, 'data'> = {},
) => {
  return prisma.participant.create({
    ...args,
    data: buildParticipantCreateInput(overrides),
  });
};
