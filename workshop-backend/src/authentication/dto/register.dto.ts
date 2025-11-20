import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';

/**
 * Registration DTO for creating a new account from an invitation.
 * Frontend must provide both the token hash (from GET /auth/invites/consume) and the password.
 */
export class RegisterDto {
  @ApiProperty({
    example: 'abc123def456...',
    description: 'Token hash returned from GET /auth/invites/consume endpoint',
  })
  @IsString({ message: 'Token hash must be a string' })
  @IsNotEmpty({ message: 'Token hash is required' })
  tokenHash: string;

  @ApiProperty({
    example: 'SecurePassword123!?',
    description: 'Password for the new account (8-128 chars, must contain uppercase, lowercase, number, and special character)',
    minLength: 8,
    maxLength: 128
  })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password cannot exceed 128 characters' })
  @Matches(/(?=.*[a-z])/, { message: 'Password must contain at least one lowercase letter' })
  @Matches(/(?=.*[A-Z])/, { message: 'Password must contain at least one uppercase letter' })
  @Matches(/(?=.*[0-9])/, { message: 'Password must contain at least one number' })
  @Matches(/(?=.*[^A-Za-z0-9])/, { message: 'Password must contain at least one special character' })
  password: string;
}