import { Injectable, UnauthorizedException } from '@nestjs/common';
import { RefreshTokenStatus, UserRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { AuthenticationRepository } from './authentication.repository';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthenticationService {
  constructor(
    private repository: AuthenticationRepository,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) { }
  async login(loginDto: LoginDto): Promise<{
    access_token: string;
    refresh_token: string;
    user: {
      id: number;
      email: string;
      role: UserRole;
    };
  }> {
    const { email, password } = loginDto;

    const user = await this.repository.findUserByEmail(email);

    if (!user || user.isDisabled) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate access token (short-lived)
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const jwtExpires = this.configService.get<string>('JWT_EXPIRES_IN') || '15m';
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: jwtExpires,
    });

    // Generate refresh token (moderate duration for workshop staff)
    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async validateUser(userId: string) {
    const user = await this.repository.findUserById(Number(userId));

    if (!user || user.isDisabled) {
      throw new UnauthorizedException('User not found or disabled');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }

  /**
   * Generates a new refresh token and stores it in the database
   */
  private async generateRefreshToken(userId: number): Promise<string> {
    // Generate a random token
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Calculate expiration using config REFRESH_EXPIRES_HOURS (default 8h)
    const refreshHours = parseInt(this.configService.get<string>('REFRESH_EXPIRES_HOURS') || '8', 10);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + refreshHours);

    // Store in database
    await this.repository.createRefreshToken({
      tokenHash,
      userId,
      expiresAt,
    });

    return token;
  }

  /**
   * Validates a refresh token and returns the associated user
   * @param token - The refresh token to validate
   * @returns Promise containing user info and tokenId (CUID string from RefreshToken.id)
   */
  async validateRefreshToken(token: string): Promise<{ user: { id: number; email: string; role: UserRole }, tokenId: string }> {
    // Ensure token is a non-empty string. Don't rely on an arbitrary min length
    // because different token encodings (hex/base64url) have different lengths.
    if (!token || typeof token !== 'string' || token.trim() === '') {
      throw new UnauthorizedException('Refresh token required');
    }

    // Refresh tokens are hex-encoded 32 random bytes = 64 characters
    // Use proper length check to quickly reject malformed tokens
    if (token.length !== 64) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    // Additional format validation: hex should only contain [0-9a-f]
    if (!/^[0-9a-f]+$/.test(token)) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    // Create deterministic hash for direct lookup
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Direct lookup by hash
    const validToken = await this.repository.findValidRefreshToken(tokenHash);

    // Verify token exists and not expired
    if (!validToken || validToken.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Get the user
    const user = await this.repository.findUserById(validToken.userId);

    if (!user || user.isDisabled) {
      throw new UnauthorizedException('User not found or disabled');
    }

    // tokenId is a CUID string (from Prisma @default(cuid()) in RefreshToken.id)
    return { user: { id: user.id, email: user.email, role: user.role }, tokenId: validToken.id };
  }

  /**
   * Generates a new access token from a valid refresh token
   */
  async refreshAccessToken(refreshToken: string, rotateRefreshToken = true): Promise<{
    access_token: string;
    refresh_token: string;
    user: {
      id: number;
      email: string;
      role: UserRole;
    };
  }> {
    const { user, tokenId } = await this.validateRefreshToken(refreshToken);

    // Generate new access token
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const jwtExpires = this.configService.get<string>('JWT_EXPIRES_IN') || '15m';
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: jwtExpires,
    });

    let newRefreshToken = refreshToken;

    // Optionally rotate the refresh token for better security
    if (rotateRefreshToken) {
      // Generate new token string (this is what client will use)
      const newTokenString = crypto.randomBytes(32).toString('hex');
      
      // Calculate expiration using config REFRESH_EXPIRES_HOURS (same as initial token and cookie)
      const refreshHours = parseInt(this.configService.get<string>('REFRESH_EXPIRES_HOURS') || '8', 10);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + refreshHours);
      
      // Generate token data for database (with hash)
      const newTokenData = {
        tokenHash: crypto.createHash('sha256').update(newTokenString).digest('hex'),
        userId: user.id,
        expiresAt,
      };
      
      try {
        await this.repository.rotateRefreshToken(
          crypto.createHash('sha256').update(refreshToken).digest('hex'),
          newTokenData
        );
        // Return the original token string (not the hash or ID)
        newRefreshToken = newTokenString;
      } catch (error) {
        // Token was already rotated/revoked - prevent reuse
        throw new UnauthorizedException('Invalid or expired refresh token');
      }
    }

    return {
      access_token: accessToken,
      refresh_token: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Revokes a specific refresh token
   */
  async revokeRefreshToken(token: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await this.repository.revokeRefreshToken(tokenHash);
  }

  /**
   * Revokes all refresh tokens for a user (logout from all sessions)
   */
  async revokeAllRefreshTokens(userId: number) {
    await this.repository.revokeAllUserTokens(userId);
  }

  /**
   * Cleanup expired and revoked tokens (can be called periodically)
   */
  async cleanupTokens() {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    await this.repository.cleanupExpiredTokens(oneDayAgo);
  }

  /**
   * Get active tokens for a user (for session validation)
   */
  async getActiveTokensForUser(userId: number) {
    return await this.repository.getActiveTokensForUser(userId);
  }

}