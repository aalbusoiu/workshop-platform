import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

/**
 * JWT token payload for session participants.
 */
export interface ParticipantTokenPayload {
  sid: number; // session ID
  pid: number; // participant ID
  exp: number; // expiration timestamp (unix seconds)
}

/**
 * Token signing result with token and expiration date.
 */
export interface TokenResult {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

/**
 * Creates a SHA-256 hash of the token for secure storage.
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Gets the JWT secret from environment, throws if missing.
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

/**
 * Gets the session token TTL from environment, throws if invalid.
 */
function getSessionTokenTtlMinutes(): number {
  const raw = process.env.SESSION_CODE_TTL_MINUTES;
  const minutes = Number(raw);
  if (!Number.isInteger(minutes) || minutes <= 0) {
    throw new Error(
      `SESSION_CODE_TTL_MINUTES must be a positive integer, got: ${raw}`,
    );
  }
  return minutes;
}

/**
 * Signs a JWT token for a session participant.
 */
export function signParticipantToken({
  sessionId,
  participantId,
  ttlMinutes = getSessionTokenTtlMinutes(),
}: {
  sessionId: number;
  participantId: number;
  ttlMinutes?: number;
}): TokenResult {
  const secret = getJwtSecret();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);
  const exp = Math.floor(expiresAt.getTime() / 1000);

  const payload: ParticipantTokenPayload = {
    sid: sessionId,
    pid: participantId,
    exp,
  };

  const token = jwt.sign(payload, secret, {
    algorithm: 'HS256',
  });

  const tokenHash = hashToken(token);

  return { token, tokenHash, expiresAt };
}

/**
 * Verifies and decodes a participant JWT token.
 */
export function verifyParticipantToken(token: string): ParticipantTokenPayload {
  const secret = getJwtSecret();
  
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    }) as ParticipantTokenPayload;
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error(`Invalid token: ${error.message}`);
    }
    throw error;
  }
}

// Creates hash from token to verify against stored hash.
export function createTokenHash(token: string): string {
  return hashToken(token);
}