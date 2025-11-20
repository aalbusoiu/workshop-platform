import { config } from 'dotenv';
import {
  signParticipantToken,
  verifyParticipantToken,
  createTokenHash,
} from '../../../src/participants/participant-token';

/**
 * Covers the pure helper functions that issue, verify, and hash participant tokens.
 * Each test toggles env vars or manipulates tokens to check the error handling and hashing behaviour.
 */
describe('participant-token helpers', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    config({ override: true, path: '.env.test' });
    process.env.JWT_SECRET = 'unit-test-secret';
    process.env.SESSION_CODE_TTL_MINUTES = '15';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  /**
   * Validates that token signing refuses to run without JWT_SECRET.
   * The env var is removed before calling signParticipantToken, and the helper should throw a descriptive error.
   */
  it('throws when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;

    expect(() =>
      signParticipantToken({ sessionId: 1, participantId: 1 }),
    ).toThrow('JWT_SECRET environment variable is required');
  });

  /**
   * Ensures invalid TTL values trigger errors.
   * Each provided value is set on the env var and the signer should complain about non-positive integers.
   */
  it.each(['0', '-5', 'abc'])(
    'throws when SESSION_CODE_TTL_MINUTES=%s is invalid',
    (invalid) => {
      process.env.SESSION_CODE_TTL_MINUTES = invalid;

      expect(() =>
        signParticipantToken({ sessionId: 1, participantId: 1 }),
      ).toThrow('SESSION_CODE_TTL_MINUTES must be a positive integer');
    },
  );

  /**
   * Confirms valid tokens can be verified and tampered ones get rejected.
   * The test signs a token, checks the decoded payload, then flips a character and expects verification to fail.
   */
  it('verifies a token and rejects tampering', () => {
    const { token } = signParticipantToken({
      sessionId: 42,
      participantId: 99,
    });

    expect(verifyParticipantToken(token)).toMatchObject({
      sid: 42,
      pid: 99,
    });

    const mangled = token.replace(/\w/, (c) => (c === 'A' ? 'B' : 'A'));
    expect(() => verifyParticipantToken(mangled)).toThrow('Invalid token');
  });
  
  /**
   * Checks token hashing produces stable SHA-256 digests.
   * A single call returns a 64-character hex string, and re-hashing the same input yields an identical value.
   */
  it('hashes tokens consistently', () => {
    const hash = createTokenHash('example.token.value');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(createTokenHash('example.token.value')).toBe(hash);
  });
});
