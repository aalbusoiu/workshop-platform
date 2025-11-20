import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '@prisma/client';

export class CreateInviteDto {
  @ApiProperty({
    example: 'newuser@example.com',
    description: 'Email address to invite',
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
    example: 'RESEARCHER',
    description: 'Role to assign to the invited user',
    enum: UserRole,
    required: true
  })
  @IsEnum(UserRole, { message: 'Role must be a valid UserRole' })
  role: UserRole;
}