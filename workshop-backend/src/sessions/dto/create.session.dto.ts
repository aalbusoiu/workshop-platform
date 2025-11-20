import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateSessionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxParticipants?: number; // falls back to Prisma default (5) if omitted
}