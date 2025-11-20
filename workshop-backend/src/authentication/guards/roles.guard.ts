import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Roles Authorization Guard
 *
 * - Returns false when a role-protected endpoint is accessed without an authenticated user.
 * - If no roles are set on the handler/class, the endpoint is not role-restricted and access is allowed.
 * - Optionally allows `ADMIN` to bypass role checks (common pattern).
 *
 * Usage:
 *  @UseGuards(JwtAuthGuard, RolesGuard)
 *  @Roles(Role.ADMIN)
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    // Read roles metadata defined by @Roles(). Returns undefined when not set.
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are defined, endpoint is public / not role-restricted — allow.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Obtain request and user (JwtAuthGuard should populate req.user).
    const req = context.switchToHttp().getRequest<import('express').Request & { user?: { id?: number; role?: UserRole } }>();
    const user = req.user;

    // If there's no authenticated user, deny access to role-protected endpoints.
    if (!user) {
      return false;
    }

    // allow admins to access any role-protected endpoint
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // Ensure safe comparison even if user.role is a string
    return requiredRoles.some((role) => user.role === role);
  }
}