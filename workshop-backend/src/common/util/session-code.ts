import { randomBytes } from 'crypto';

const SAFE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1

export function getSessionCodeLength(): number {
  const raw = process.env.SESSION_CODE_LENGTH;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(
      `SESSION_CODE_LENGTH must be a positive integer, got: ${raw}`,
    );
  }
  return n;
}

/**
 * Generates a session code using the exact length from env.
 */
export function generateSessionCode(length = getSessionCodeLength()): string {
  const bytes = safeRandomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += SAFE_ALPHABET[bytes[i] % SAFE_ALPHABET.length];
  }
  return code;
}

/**
 * Normalizes user-provided session code input:
 * - trims
 * - uppercases
 * - removes all non [A-Z0-9]
 */
export function normalizeSessionCode(input: string): string {
  return (input || '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Format check for a session code using the exact env length.
 */
export function isValidSessionCode(code: string): boolean {
  const len = getSessionCodeLength();
  return (
    typeof code === 'string' &&
    code.length === len &&
    /^[A-Z0-9]+$/.test(code) &&
    [...code].every((c) => SAFE_ALPHABET.includes(c))
  );
}

function safeRandomBytes(n: number): Uint8Array {
  try {
    return randomBytes(n);
  } catch {
    const arr = new Uint8Array(n);
    for (let i = 0; i < n; i++) arr[i] = Math.floor(Math.random() * 256);
    return arr;
  }
}
