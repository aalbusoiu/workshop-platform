import { IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LeaveSessionDto {
  @ApiProperty({
    description: 'JWT session token for leaving the session',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    minLength: 10,
  })
  @IsString({ message: 'Token must be a string' })
  @MinLength(10, { message: 'Token must be at least 10 characters long' })
  @Matches(/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/, { message: 'Token must be a valid JWT' })
  token: string;
}