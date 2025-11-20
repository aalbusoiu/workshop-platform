import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import type { JoinSessionDto as JoinSessionDtoType } from '../../../src/participants/dto/join.session.dto';

const ORIGINAL_ENV = { ...process.env };
let pipe: ValidationPipe;
let metadata: ArgumentMetadata;
let JoinSessionDto: typeof JoinSessionDtoType;

beforeAll(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV, SESSION_CODE_LENGTH: '5' };

  // Load the DTO after the env var is in place
  ({ JoinSessionDto } = require('../../../src/participants/dto/join.session.dto'));

  pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  metadata = {
    type: 'body',
    metatype: JoinSessionDto,
    data: undefined,
  };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

const transform = (payload: Record<string, unknown>) =>
  pipe.transform(payload, metadata);

/**
 * Validates every branch of JoinSessionDto using Nest’s ValidationPipe.
 * Each test feeds a sample payload into the pipe and inspects the transformed result or thrown error.
 */
describe('JoinSessionDto', () => {
  
  /**
   * Checks that user input is normalised and cleaned.
   * The test sends lower-case code, lower-case colour, and padded display name, then ensures each field is adjusted.
   */
  it('normalises code, colour, and trims display name', async () => {
    const result = await transform({
      code: ' ab-2c d ',
      colorHex: '#ffaa00',
      displayName: '  Taylor  ',
    });

    expect(result.code).toBe('AB2CD');
    expect(result.colorHex).toBe('#FFAA00');
    expect(result.displayName).toBe('Taylor');
  });

  /**
   * Confirms empty names are treated as absent.
   * Passing only spaces for displayName should yield undefined instead of an empty string.
   */
  it('treats blank display name as undefined', async () => {
    const result = await transform({
      code: 'ABCDE',
      colorHex: '#FFAA00',
      displayName: '   ',
    });

    expect(result.displayName).toBeUndefined();
  });

  /**
   * Verifies the custom session-code validator rejects disallowed characters.
   * A code containing digits that are not part of the safe alphabet should fail with a BadRequestException.
   */
  it('rejects codes with disallowed characters', async () => {
    await expect(
      transform({
        code: '12345',
        colorHex: '#ABCDEF',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  
  /**
   * Ensures the colour field enforces proper hex format.
   * Supplying a non-hex value should trigger a validation error.
   */
  it('rejects invalid colour formats', async () => {
    await expect(
      transform({
        code: 'ABCDE',
        colorHex: 'blue',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  /**
   * Confirms existingToken must be a string whenever it is present.
   * Providing a numeric value should raise BadRequestException.
   */
  it('requires existingToken to be a string when provided', async () => {
    await expect(
      transform({
        code: 'ABCDE',
        colorHex: '#ABCDEF',
        existingToken: 123 as any,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  /**
   * Verifies numeric codes get coerced to strings before validation.
   * Passing a number should be accepted once converted to the string form.
   */
  it('coerces a numeric code value into a string and accepts it when valid', async () => {
    const result = await transform({
      code: 22222, // becomes "22222"
      colorHex: '#FFAA00',
    });

    expect(result.code).toBe('22222');
  });

  /**
   * Ensures non-string display names are treated as missing.
   * Sending a number should not fail validation but should result in undefined.
   */
  it('treats non-string display names as undefined without failing validation', async () => {
    const result = await transform({
      code: 'ABCDE',
      colorHex: '#FFAA00',
      displayName: 123 as any,
    });

    expect(result.displayName).toBeUndefined();
  });

  /**
   * Confirms colour inputs that are not strings cause validation to fail.
   * A numeric colour value should throw a BadRequestException.
   */
  it('rejects non-string colour values', async () => {
    await expect(
      transform({
        code: 'ABCDE',
        colorHex: 123 as any,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  /**
   * Checks that a valid string existingToken passes through unchanged.
   * Supplying a proper string should return the same value after transformation.
   */
  it('accepts an optional existingToken when provided as a string', async () => {
    const result = await transform({
      code: 'ABCDE',
      colorHex: '#FFAA00',
      existingToken: 'rejoin-token',
    });

    expect(result.existingToken).toBe('rejoin-token');
  });

});
