
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ScenariosRepository } from './scenarios.repository';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { UpdateScenarioDto } from './dto/update-scenario.dto';
import { ListScenariosDto } from './dto/list-scenario.dto';

/**
 * Service that contains all business logic for managing scenarios,
 * including validation of the Gemini prompt and mapping repository
 * entities into a clean, API-friendly shape.
 */
@Injectable()
export class ScenariosService {
  constructor(private readonly repository: ScenariosRepository) {}

  /**
   * Creates a new scenario after validating the incoming DTO values,
   * and returns a normalized object containing the main scenario fields.
   */

   async createScenario(dto: CreateScenarioDto) {
    this.ensurePayloadValid(dto.payload);

    const scenario = await this.repository.createScenario({
      title: dto.title,
      description: dto.description,
      category: dto.category,
      payload: dto.payload,
    });

    return this.toView(scenario);
  }

  /**
   * Updates an existing scenario identified by ID using the provided DTO,
   * validating the prompt when it is present and throwing when the scenario
   * does not exist.
   */
   async updateScenario(id: number, dto: UpdateScenarioDto) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException('Scenario not found');
    }

    if (dto.payload !== undefined) {
      this.ensurePayloadValid(dto.payload);
    }

    const updated = await this.repository.updateScenario(id, {
      title: dto.title,
      description: dto.description,
      category: dto.category,
      payload: dto.payload,
    });

    return this.toView(updated);
  }

  /**
   * Retrieves a single scenario by ID and returns a normalized view object,
   * or throws a NotFoundException when the scenario does not exist.
   */
  async getScenario(id: number) {
    const scenario = await this.repository.findById(id);
    if (!scenario) {
      throw new NotFoundException('Scenario not found');
    }
    return this.toView(scenario);
  }

  /**
   * Lists active scenarios that match the optional search and category filters,
   * returning each one as a normalized view object.
   */
  async listScenarios(query: ListScenariosDto) {
    const scenarios = await this.repository.listScenarios({
      search: query.search,
      category: query.category,
    });

    return scenarios.map((scenario) => this.toView(scenario));
  }

   /**
   * Validates that the payload (Gemini prompt) is a non-empty string
   * and throws a BadRequestException when it is not.
   */
  private ensurePayloadValid(payload: string) {
    if (!payload || typeof payload !== 'string' || !payload.trim()) {
      throw new BadRequestException('Scenario payload must be a non-empty Gemini prompt');
    }
  }

  
    /**
   * Archives an existing scenario by setting its isActive flag to false.
   * First ensures the scenario exists; if it is already inactive, it simply
   * returns the current view without performing another write.
   */
  async archiveScenario(id: number) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException('Scenario not found');
    }

    if (!existing.isActive) {
      return this.toView(existing);
    }

    const archived = await this.repository.archiveScenario(id);
    return this.toView(archived);
  }
  
  
  /**
   * Maps a raw Prisma Scenario entity into a simpler view object that exposes
   * the prompt separately from the payload column.
   */
  private toView(scenario: any) {
    return {
      id: scenario.id,
      title: scenario.title,
      description: scenario.description,
      category: scenario.category,
      isActive: scenario.isActive,
      createdAt: scenario.createdAt,
      updatedAt: scenario.updatedAt,
      payload: scenario.payload as string | null,
    };
  }

}