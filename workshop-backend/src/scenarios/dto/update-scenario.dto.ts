// src/scenarios/dto/update-scenario.dto.ts

import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO used when updating an existing Scenario, allowing callers to send
 * only the fields they want to change while leaving others untouched.
 */
export class UpdateScenarioDto {
  @ApiPropertyOptional({
    description: 'New title for the scenario',
    example: 'Revised onboarding usability test',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({
    description: 'New description for the scenario',
    example: 'Updated flow focusing on mobile onboarding issues.',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'New category label for the scenario',
    example: 'Onboarding',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({
    description: 'New Gemini prompt payload for the scenario',
    example: 'You are simulating a revised onboarding session with focus on mobile users...',
  })
  @IsString()
  @IsOptional()
  payload?: string;
}
