import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/**
 * Key used to store role information for endpoints.
 * The guard uses this key to check if a user has the right role.
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator to specify which roles can access an endpoint.
 * 
 * @param roles - List of roles that can access this endpoint
 * 
 * @example
 * // Only moderators can access
 * @Roles(Role.MODERATOR)
 * 
 * // Moderators or admins can access
 * @Roles(Role.MODERATOR, Role.ADMIN)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);