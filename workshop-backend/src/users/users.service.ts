import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersRepository, ListUsersParams } from './users.repository';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { AuditLogService } from '../common/audit/audit.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly auditService: AuditLogService,
  ) {}

  async listUsers(query: ListUsersQueryDto) {
    const params: ListUsersParams = {
      role: query.role,
      search: query.search,
    };

    return this.repo.listUsers(params);
  }

  async updateUserRole(userId: number, updateDto: UpdateUserRoleDto, actorUserId: number) {
    // Find the user to update
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isDisabled) {
      throw new BadRequestException('Cannot update role of disabled user');
    }

    // Prevent self-role changes
    if (userId === actorUserId) {
      throw new ForbiddenException('Cannot change your own role');
    }

    // Validate role transition
    this.validateRoleTransition(user.role, updateDto.role);

    // No change needed
    if (user.role === updateDto.role) {
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        message: 'Role is already set to the requested value',
      };
    }

    // Update the role
    const updatedUser = await this.repo.updateUserRole(userId, updateDto.role);

    // Log the role change for audit trail
    await this.auditService.logUserRoleChanged({
      actorUserId,
      targetUserId: userId,
      previousRole: user.role,
      newRole: updateDto.role,
    });

    return {
      ...updatedUser,
      message: `Role updated from ${user.role} to ${updateDto.role}`,
    };
  }
  /**
   * Validate proper role transitions
   */
  private validateRoleTransition(currentRole: UserRole, newRole: UserRole): void {
    // Define allowed role transitions
    const allowedTransitions: Record<UserRole, UserRole[]> = {
      [UserRole.ADMIN]: [], // Admins cannot be downgraded (security protection)
      [UserRole.MODERATOR]: [UserRole.RESEARCHER, UserRole.ADMIN], // Moderators can become researchers or get promoted to admin
      [UserRole.RESEARCHER]: [UserRole.MODERATOR, UserRole.ADMIN], // Researchers can become moderators or get promoted to admin
    };

    const allowedNewRoles = allowedTransitions[currentRole] || [];

    if (!allowedNewRoles.includes(newRole)) {
      throw new BadRequestException(
        `Invalid role transition: ${currentRole} cannot be changed to ${newRole}. Admins cannot be downgraded for security reasons.`
      );
    }
  }
}
