import { Injectable } from '@nestjs/common';
import { Prisma, User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ListUsersParams {
  role?: UserRole;
  search?: string;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(params: ListUsersParams): Promise<Pick<User, 'id' | 'email' | 'role' | 'createdAt'>[]> {
    const where: Prisma.UserWhereInput = {
      isDisabled: false,
    };

    // Filter by role if provided, ensuring only MODERATOR or RESEARCHER
    if (params.role && (params.role === UserRole.MODERATOR || params.role === UserRole.RESEARCHER)) {
      where.role = params.role;
    } else {
      // Default: return both MODERATOR and RESEARCHER (exclude ADMIN)
      where.role = { in: [UserRole.MODERATOR, UserRole.RESEARCHER] };
    }

    // Add search filter if provided
    if (params.search?.trim()) {
      where.email = {
        contains: params.search.trim(),
        mode: 'insensitive'
      };
    }

    return this.prisma.user.findMany({
      where,
      select: { id: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find a user by ID for role updates
   */
  async findUserById(userId: number): Promise<Pick<User, 'id' | 'email' | 'role' | 'isDisabled'> | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, isDisabled: true },
    });
  }

  /**
   * Update a user's role
   */
  async updateUserRole(userId: number, newRole: UserRole): Promise<Pick<User, 'id' | 'email' | 'role'>> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
      select: { id: true, email: true, role: true },
    });
  }
}
