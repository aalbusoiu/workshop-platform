import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { SessionStatus } from '@prisma/client';

/**
 * Repository for session-related database operations.
 */
@Injectable()
export class SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}


  // Session management methods

  /**
   * Creates a new workshop session.
   */
  async createSession({
    code,
    createdById,
    maxParticipants,
  }: {
    code: string;
    createdById: number;
    maxParticipants?: number;
  }) {
    return this.prisma.workshopSession.create({
      data: {
        code,
        createdById,
        ...(maxParticipants !== undefined ? { maxParticipants } : {}),
        status: 'LOBBY',
      },
    });
  }

  /**
   * Finds a session by its code.
   */
  async findByCode(code: string) {
    return this.prisma.workshopSession.findUnique({
      where: { code },
    });
  }

  /**
   * Updates session status with validation.
   */
  async updateSessionStatus(sessionId: number, newStatus: SessionStatus) {
    return await this.prisma.workshopSession.update({
      where: { id: sessionId },
      data: { status: newStatus },
    });
  }

  /**
   * Finds session by ID with participant count.
   */
  async findSessionById(sessionId: number) {
    return await this.prisma.workshopSession.findUnique({
      where: { id: sessionId },
      include: {
        _count: {
          select: { participants: true }
        },
        createdBy: {
          select: { id: true, email: true, role: true }
        }
      },
    });
  }

  /**
   * Finds session by ID for owner verification.
   */
  async findSessionForOwnerCheck(sessionId: number, userId: number) {
    return await this.prisma.workshopSession.findFirst({
      where: { 
        id: sessionId,
        createdById: userId 
      },
    });
  }

  /**
   * Checks if error is a Prisma unique constraint violation (P2002).
   */
  isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }


  /**
   * These repository helpers accept a Prisma.TransactionClient (tx) so callers 
   * can execute multiple writes inside a single ACID transaction. Prisma only guarantees 
   * atomicity per statement unless all queries share the same tx from $transaction; 
   * mixing tx-scoped and non-tx calls will run outside the transaction and can 
   * leave partial changes if an error occurs. This way we chain every step with the 
   * provided tx so either all changes commit or none do.
   */


  withTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  async revokeAllParticipantTokens(sessionId: number, tx: Prisma.TransactionClient): Promise<void> {
    await tx.sessionToken.updateMany({
      where: {
        revokedAt: null,
        participant: { sessionId },
      },
      data: { revokedAt: new Date() },
    });
  }

  async deleteAllParticipants(sessionId: number, tx: Prisma.TransactionClient): Promise<void> {
    await tx.participant.deleteMany({
      where: { sessionId },
    });
  }

  // “BMC drafts” = BmcProfile for this session
  async deleteAllBmcDrafts(sessionId: number, tx: Prisma.TransactionClient): Promise<void> {
    await tx.bmcProfile.deleteMany({
      where: { sessionId },
    });
  }

  async deleteSessionRow(sessionId: number, tx: Prisma.TransactionClient) {
    return tx.workshopSession.delete({ where: { id: sessionId } });
  }

  async updateSessionStatusTx(sessionId: number, newStatus: SessionStatus, tx: Prisma.TransactionClient) {
    return tx.workshopSession.update({
      where: { id: sessionId },
      data: { status: newStatus },
    });
  }

}