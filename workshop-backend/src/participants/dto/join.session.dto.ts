import { Transform } from 'class-transformer';
import {
  IsString,
  Matches,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  normalizeSessionCode,
  isValidSessionCode,
  getSessionCodeLength,
} from '../../common/util/session-code';

/**
 * Custom validator for session codes - validates length and safe alphabet.
 */
@ValidatorConstraint({ name: 'sessionCode', async: false })
export class SessionCodeValidator implements ValidatorConstraintInterface {
  validate(code: string): boolean {
    if (typeof code !== 'string') {
      return false;
    }
    const normalized = normalizeSessionCode(code);
    return isValidSessionCode(normalized);
  }

  defaultMessage(): string {
    const length = getSessionCodeLength();
    return `Session code must be ${length} characters long and contain only letters and numbers (no I, O, 0, 1)`;
  }
}

/**
 * DTO for joining a workshop session by code.
 * Participants are identified by color and optional display name.
 */
export class JoinSessionDto {
  /**
   * Session code to join - automatically normalized (trimmed, uppercased, non-alphanumeric removed).
   */
  @ApiProperty({
    description: 'Session code to join',
    example: 'AC23D',
    minLength: getSessionCodeLength(),
    maxLength: getSessionCodeLength(),
  })
  @IsString()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return normalizeSessionCode(value);
    }
    return String(value || '');
  })
  @Validate(SessionCodeValidator)
  code: string;

  /**
   * Participant color in hex format - automatically uppercased.
   */
  @ApiProperty({
    description: 'Participant color in hex format',
    example: '#FF5733',
    pattern: '^#[0-9A-F]{6}$',
  })
  @IsString()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toUpperCase();
    }
    return undefined;
  })
  @Matches(/^#[0-9A-F]{6}$/, {
    message: 'Color must be in hex format (#RRGGBB)',
  })
  colorHex: string;


    /**
   * Optional display name for the participant.
   */
  @ApiProperty({
    description: 'Optional display name for the participant',
    example: 'John Doe',
    required: false,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, {
    message: 'Display name must not exceed 50 characters',
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim() || undefined;
    }
    return undefined;
  })
  displayName?: string;

  /**
   * Optional existing session token for rejoining participants.
   */
  @ApiProperty({
    description: 'Optional existing session token for rejoining participants',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: false,
  })
  @IsOptional()
  @IsString()
  existingToken?: string;

}
