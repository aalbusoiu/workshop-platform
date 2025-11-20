// src/scenarios/dto/list-scenario.dto.ts
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO representing query parameters for listing scenarios in the library.
 */
export class ListScenariosDto {
  @ApiPropertyOptional({
    description: 'Free-text search over title and description',
    example: 'onboarding',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by category',
    example: 'Usability',
  })
  @IsString()
  @IsOptional()
  category?: string;
}
