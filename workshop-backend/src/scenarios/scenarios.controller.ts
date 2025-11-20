import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import { UserRole } from '@prisma/client';
import { ScenariosService } from './scenarios.service';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { UpdateScenarioDto } from './dto/update-scenario.dto';
import { ListScenariosDto } from './dto/list-scenario.dto';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { Roles } from '../authentication/decorators/roles.decorator';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    id: number;
    email?: string;
    role: UserRole;
  };
}

/**
 * Controller exposing HTTP endpoints for managing scenarios and their
 * Gemini prompt payloads, secured for moderator and admin users.
 */
@ApiTags('Scenarios v1')
@Controller({
  path: 'scenarios',
  version: '1',
})
export class ScenariosController {
  constructor(private readonly scenariosService: ScenariosService) {}

  /**
   * Creates a new scenario with title, description, optional category and
   * payload, restricted to moderators (and optionally admins).
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.RESEARCHER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new scenario' })
  @ApiResponse({ status: 201, description: 'Scenario created successfully' })
  async createScenario(
    @Body() dto: CreateScenarioDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.scenariosService.createScenario(dto);
  }

  /**
   * Updates an existing scenario identified by its ID using the partial
   * fields provided in the request body.
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.RESEARCHER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an existing scenario' })
  @ApiResponse({ status: 200, description: 'Scenario updated successfully' })
  @ApiResponse({ status: 404, description: 'Scenario not found' })
  async updateScenario(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateScenarioDto,
  ) {
    return this.scenariosService.updateScenario(id, dto);
  }

  /**
   * Lists active scenarios in the moderator library, supporting optional
   * search and category filters.
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.RESEARCHER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List scenarios in the library' })
  @ApiResponse({ status: 200, description: 'Scenarios listed successfully' })
  async listScenarios(@Query() query: ListScenariosDto) {
    return this.scenariosService.listScenarios(query);
  }

  /**
   * Retrieves a single scenario by its ID and returns its metadata and payload.
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.RESEARCHER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get details for a specific scenario' })
  @ApiResponse({ status: 200, description: 'Scenario retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Scenario not found' })
  async getScenario(@Param('id', ParseIntPipe) id: number) {
    return this.scenariosService.getScenario(id);
  }



  /**
   * Archives a scenario so it no longer appears in the active library
   * by setting its isActive flag to false.
   */
  @Patch(':id/archive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.RESEARCHER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archive a scenario (set isActive = false)' })
  @ApiResponse({ status: 200, description: 'Scenario archived successfully' })
  @ApiResponse({ status: 404, description: 'Scenario not found' })
  async archiveScenario(@Param('id', ParseIntPipe) id: number) {
    return this.scenariosService.archiveScenario(id);
  }

}