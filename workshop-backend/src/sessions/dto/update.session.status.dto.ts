import { ApiProperty } from '@nestjs/swagger';
import { SessionStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateSessionStatusDto {
  @ApiProperty({
    description: 'New session status',
    enum: SessionStatus,
    example: SessionStatus.LOBBY,
  })
  @IsEnum(SessionStatus, { message: 'Status must be one of: LOBBY, RUNNING, ENDED, ABANDONED' })
  status: SessionStatus;
}