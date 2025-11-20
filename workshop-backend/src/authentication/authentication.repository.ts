import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RefreshTokenStatus, Prisma, User, RefreshToken } from '@prisma/client';

@Injectable()
export class AuthenticationRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find a user by email
   */
  async findUserByEmail(email: string): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Find a user by ID
   */
  async findUserById(id: number): Promise<User | null> {
    return await this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Create a new refresh token
   */
  async createRefreshToken(data: {
    tokenHash: string;
    userId: number;
    expiresAt: Date;
  }): Promise<RefreshToken> {
    return await this.prisma.refreshToken.create({
      data: {
        tokenHash: data.tokenHash,
        userId: data.userId,
        expiresAt: data.expiresAt,
        status: RefreshTokenStatus.ACTIVE,
      },
    });
  }

  /**
   * Find a valid refresh token by hash
   */
  async findValidRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
    return await this.prisma.refreshToken.findUnique({
      where: {
        tokenHash,
        status: RefreshTokenStatus.ACTIVE,
      },
    });
  }

  /**
   * Rotate refresh token (mark old as ROTATED, create new one)
   */
  async rotateRefreshToken(
    oldTokenHash: string,
    newTokenData: {
      tokenHash: string;
      userId: number;
      expiresAt: Date;
    },
    tx?: Prisma.TransactionClient
  ): Promise<{ oldToken: RefreshToken; newToken: RefreshToken }> {
    const client = tx || this.prisma;

    // Mark old token as rotated
    const oldToken = await client.refreshToken.update({
      where: { tokenHash: oldTokenHash },
      data: {
        status: RefreshTokenStatus.ROTATED,
        revokedAt: new Date(),
      },
    });

    // Create new token
    const newToken = await client.refreshToken.create({
      data: {
        tokenHash: newTokenData.tokenHash,
        userId: newTokenData.userId,
        expiresAt: newTokenData.expiresAt,
        status: RefreshTokenStatus.ACTIVE,
      },
    });

    return { oldToken, newToken };
  }

  /**
   * Revoke a specific refresh token
   */
  async revokeRefreshToken(tokenHash: string): Promise<RefreshToken> {
    return await this.prisma.refreshToken.update({
      where: { tokenHash },
      data: {
        status: RefreshTokenStatus.REVOKED,
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: number): Promise<{ count: number }> {
    const result = await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        status: RefreshTokenStatus.ACTIVE,
      },
      data: {
        status: RefreshTokenStatus.REVOKED,
        revokedAt: new Date(),
      },
    });

    return { count: result.count };
  }

  /**
   * Clean up expired and old revoked/rotated tokens
   */
  async cleanupExpiredTokens(olderThan: Date): Promise<{ count: number }> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } }, // Expired tokens
          {
            status: { in: [RefreshTokenStatus.REVOKED, RefreshTokenStatus.ROTATED] },
            OR: [
              { revokedAt: { lt: olderThan } }, // Normal case: revoked/rotated more than grace period ago
              { revokedAt: null, expiresAt: { lt: olderThan } }, // Fallback for legacy tokens without revokedAt
            ],
          },
        ],
      },
    });

    return { count: result.count };
  }

  /**
   * Get all active tokens for a user (for admin purposes)
   */
  async getActiveTokensForUser(userId: number): Promise<RefreshToken[]> {
    return await this.prisma.refreshToken.findMany({
      where: {
        userId,
        status: RefreshTokenStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      orderBy: { expiresAt: 'desc' },
    });
  }

  /**
   * Execute operations within a transaction
   */
  async withTransaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    return await this.prisma.$transaction(callback);
  }
  /**
   * Check if error is a Prisma unique constraint violation (P2002)
   */
  isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}