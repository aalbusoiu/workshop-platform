import { Controller, Get, Patch, Query, Param, Body, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { Roles } from '../authentication/decorators/roles.decorator';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { UserRole } from '@prisma/client';

interface AuthRequest extends Request {
  user: {
    id: number;
    email?: string;
    role?: UserRole;
  };
}

@ApiTags('Users Management v1')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly service: UsersService) {}

  // Only ADMIN can list users
  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List users by role',
    description: 'Get list of users filtered by role (moderator/researcher) with optional search. Admin access only.',
  })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: ['MODERATOR', 'RESEARCHER'],
    description: 'Filter users by role. Only MODERATOR and RESEARCHER roles can be filtered.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search users by email (case-insensitive partial match)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of users returned successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number', example: 1 },
          email: { type: 'string', example: 'moderator@example.com' },
          role: { type: 'string', enum: ['MODERATOR', 'RESEARCHER'], example: 'MODERATOR' },
          createdAt: { type: 'string', format: 'date-time', example: '2025-11-14T10:30:00Z' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid JWT token' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async list(@Query() query: ListUsersQueryDto) {
    return this.service.listUsers(query);
  }

  // Only ADMIN can update user roles
  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update user role',
    description: 'Change a user\'s role with proper validation. Includes audit logging and prevents invalid transitions.',
  })
  @ApiBody({
    description: 'Role update payload',
    schema: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          enum: ['ADMIN', 'MODERATOR', 'RESEARCHER'],
          example: 'RESEARCHER',
          description: 'The new role to assign to the user'
        }
      },
      required: ['role']
    },
    examples: {
      promoteToModerator: {
        summary: 'Promote to Moderator',
        description: 'Promote a researcher to moderator role',
        value: {
          role: 'MODERATOR'
        }
      },
      demoteToResearcher: {
        summary: 'Demote to Researcher', 
        description: 'Demote a moderator to researcher role',
        value: {
          role: 'RESEARCHER'
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Role updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        email: { type: 'string', example: 'user@example.com' },
        role: { type: 'string', enum: ['ADMIN', 'MODERATOR', 'RESEARCHER'], example: 'RESEARCHER' },
        message: { type: 'string', example: 'Role updated from MODERATOR to RESEARCHER' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid role transition or disabled user' })
  @ApiResponse({ status: 403, description: 'Forbidden - Cannot change own role or admin access required' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateRole(
    @Param('id', ParseIntPipe) userId: number,
    @Body() updateDto: UpdateUserRoleDto,
    @Request() req: AuthRequest,
  ) {
    return this.service.updateUserRole(userId, updateDto, req.user.id);
  }
}
