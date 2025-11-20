import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'User email address',
    required: true,
    minLength: 5,
    maxLength: 254
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  @MinLength(5, { message: 'Email must be at least 5 characters' })
  @MaxLength(254, { message: 'Email cannot exceed 254 characters' })
  email: string;

  @ApiProperty({
    example: 'SecurePassword123!?',
    description: 'User password',
    minLength: 8,
    maxLength: 128,
  })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 character long' })
  @MaxLength(128, { message: 'Password cannot exceed 128 characters' })
  password: string;
}