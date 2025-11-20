// src/scenarios/dto/create-scenario.dto.ts

import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO used when creating a new Scenario, carrying user-facing metadata and
 * the payload string that contains the full Gemini prompt content.
 */
export class CreateScenarioDto {
  @ApiProperty({
    description: 'Human-readable title of the scenario',
    example: 'Onboarding usability stress test',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty({
    description: 'Short description explaining what the scenario is about',
    example: 'Participants experience the first 10 minutes of product onboarding.',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({
    description: 'Optional category label for grouping scenarios',
    example: 'Usability',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;

  @ApiProperty({
    description: 'Full prompt used to run this scenario',
    example: 'You are simulating an onboarding session for a new SaaS product...',
  })
  @IsString()
  @IsNotEmpty()
  payload!: string;
}
