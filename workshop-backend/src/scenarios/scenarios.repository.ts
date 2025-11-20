import { Injectable } from '@nestjs/common';
import { Prisma, RoundStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Repository that encapsulates all Prisma access for scenarios, sessions and rounds,
 * so the service layer can focus purely on business rules.
 */
@Injectable()
export class ScenariosRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new Scenario row using the provided primitive values and returns
   * the raw Prisma Scenario entity.
   */
   async createScenario(
    {
      title,
      description,
      category,
      payload,
    }: {
      title: string;
      description: string;
      category?: string;
      payload: string;
    },
  ) {
    return this.prisma.scenario.create({
      data: {
        title,
        description,
        ...(category && { category }),
        payload,
        isActive: true,
      },
    });
  }

  /**
   * Updates an existing Scenario row by ID using partial input values and
   * returns the updated Prisma Scenario entity.
   */
  async updateScenario(
    id: number,
    {
      title,
      description,
      category,
      payload,
    }: {
      title?: string;
      description?: string;
      category?: string;
      payload?: string;
    },
  ) {
    const updateData: Prisma.ScenarioUpdateInput = {};

    if (title !== undefined) {
      updateData.title = title;
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    if (category !== undefined) {
      updateData.category = category;
    }

    if (payload !== undefined) {
      updateData.payload = payload;
    }

    return this.prisma.scenario.update({
      where: { id },
      data: updateData,
    });
  }
  /**
   * Looks up a Scenario by its primary key and returns it, or null when the
   * scenario does not exist in the database.
   */
  async findById(id: number) {
    return this.prisma.scenario.findUnique({
      where: { id },
    });
  }

  /**
   * Returns all active scenarios that match the optional search and category
   * filters, ordered from newest to oldest.
   */
  async listScenarios(params: { search?: string; category?: string }) {
    const where: Prisma.ScenarioWhereInput = {
      isActive: true,
    };

    if (params.category) {
      where.category = params.category;
    }

    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.scenario.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

    /**
   * Marks a scenario as archived by setting isActive to false and returns
   * the updated Prisma Scenario entity.
   */
  async archiveScenario(id: number) {
    return this.prisma.scenario.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }

}