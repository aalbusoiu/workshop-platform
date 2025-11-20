import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';


/**
 * Repository for session-related database operations.
 */
@Injectable()
export class ParticipantsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Counts participants in a session.
   */
  async countParticipants(sessionId: number, tx: Prisma.TransactionClient): Promise<number> {
    return await this.prisma.participant.count({
      where: { sessionId },
    });
  }

  /**
   * Creates a new participant in a session.
   */
  async createParticipant({
    sessionId, colorHex, displayName,
}: {
    sessionId: number;
    colorHex: string;
    displayName?: string;
}, tx: Prisma.TransactionClient) {
    return await this.prisma.participant.create({
      data: {
        sessionId,
        colorHex,
        ...(displayName && { displayName }),
      },
    });
  }

  /**
   * Deletes a participant by their ID.
   */
  async deleteParticipant(participantId: number, tx: Prisma.TransactionClient): Promise<void> {
    await this.prisma.participant.delete({
      where: {
        id: participantId,
      },
    });
  }
  
  /**
  * Finds a participant within a specific session.
  */
  async findParticipantInSession(sessionId: number, participantId: number) {
    return await this.prisma.participant.findFirst({
      where: { 
        id: participantId,
        sessionId: sessionId 
      },
    });
  }

  /**
   * Gets all participants for a session.
   */
  async getSessionParticipants(sessionId: number) {
    return await this.prisma.participant.findMany({
      where: { sessionId },
      orderBy: [
        { joinedAt: 'asc' }
      ],
    });
  }

  /**
   * Finds an active participant by their session token hash.
   * Used for rejoin detection - if valid token exists, reuse participant.
   */
  async findParticipantByToken(tokenHash: string, sessionId: number, tx: Prisma.TransactionClient) {
    return await this.prisma.sessionToken.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() }, // not expired
        revokedAt: null, // not revoked
        participant: {
          sessionId,
        },
      },
      include: {
        participant: true,
      },
    });
  }
  
  /**
   * Creates a session token for authentication.
   */
  async createSessionToken({
    participantId, tokenHash, expiresAt,
}: {
    participantId: number;
    tokenHash: string;
    expiresAt: Date;
}, tx: Prisma.TransactionClient) {
    return await this.prisma.sessionToken.create({
      data: {
        participantId,
        tokenHash,
        expiresAt,
      },
    });
  }

  /**
 * Revokes a session token by setting revokedAt.
 */
async revokeSessionToken(tokenHash: string, tx: Prisma.TransactionClient): Promise<void> {
  await this.prisma.sessionToken.updateMany({
    where: {
      tokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

/**
 * Clean up expired and old revoked session tokens
 */
async cleanupExpiredSessionTokens(olderThan: Date): Promise<{ count: number }> {
  const result = await this.prisma.sessionToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } }, // Expired tokens
        {
          revokedAt: { 
            not: null,
            lt: olderThan 
          }, // Revoked more than grace period ago
        },
      ],
    },
  });

  return { count: result.count };
}

/**
   * Executes operations within a transaction.
   */
withTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return this.prisma.$transaction(fn);
}

}