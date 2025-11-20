import { Controller, Post, Body, UseGuards, Request, Get, Query, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UserInvitationService } from './userInvitation.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from '@prisma/client';
 
@ApiTags('Invitations v1')
@ApiBearerAuth()
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class InvitationsController {
  constructor(private readonly invitationsService: UserInvitationService) {}
 
  @Post('invite')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Create invitation and send email (Admin only)',
    description: 'Generates invitation token and sends email with registration link. Token expires in 24 hours. Rate limit: 10/min'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Invitation created and email sent successfully',
    schema: {
      example: {
        message: 'Invitation sent successfully to newuser@example.com',
        invitation: {
          id: 1,
          email: 'newuser@example.com',
          role: 'MODERATOR',
          createdAt: '2025-10-28T12:00:00.000Z'
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid email format or role' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Valid JWT token required' })
  @ApiResponse({ status: 403, description: 'Forbidden - ADMIN role required' })
  @ApiResponse({ 
    status: 409, 
    description: 'Conflict - User already exists OR pending invitation found',
    schema: {
      example: {
        statusCode: 409,
        message: 'User with this email already exists'
      }
    }
  })
  @ApiResponse({ status: 429, description: 'Too many requests - Rate limit: 10/minute' })
  async createInvite(
    @Body() createInviteDto: CreateInviteDto,
    @Request() req: import('express').Request & { user?: { id?: number } },
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    const userId = Number(req.user.id);
    return this.invitationsService.createInvite(createInviteDto, userId);
  }

  @Get('invites/consume')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ 
    summary: 'Validate invitation token (Step 1 of registration)',
    description: 'Validates token from email link, marks as consumed (one-time use), returns tokenHash for registration. Token expires in 24 hours. Rate limit: 5/min'
  })
  @ApiQuery({
    name: 'token',
    description: 'Raw invitation token from email URL',
    example: 'kO8sBsUdaQDZ3QR_qdrjREAmnxiDMgx-yPa7e2VwK2s',
    required: true
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Token validated successfully - Returns tokenHash for registration',
    schema: {
      example: {
        message: 'Invitation token validated successfully',
        tokenHash: 'a1b2c3d4e5f6789abc...'
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid, expired, or already used token',
    schema: {
      examples: {
        invalid: {
          value: {
            statusCode: 400,
            message: 'Invalid invitation token'
          }
        },
        expired: {
          value: {
            statusCode: 400,
            message: 'This invitation link has expired. Please request a new invitation.'
          }
        },
        used: {
          value: {
            statusCode: 400,
            message: 'This invitation link has already been used once.'
          }
        }
      }
    }
  })
  @ApiResponse({ status: 429, description: 'Too many requests - Rate limit: 5/minute' })
  async consumeInvite(@Query('token') token: string): Promise<{ message: string; tokenHash: string }> {
    if (!token) {
      throw new BadRequestException('Invitation token is required');
    }

    // Use proper minimum length check to reject malformed tokens early
    if (token.length !== 43) {
      throw new BadRequestException('Invalid invitation token format');
    }

    // Additional format validation: base64url should only contain [A-Za-z0-9_-]
    if (!/^[A-Za-z0-9_-]+$/.test(token)) {
      throw new BadRequestException('Invalid invitation token format');
    }

    const tokenHash = await this.invitationsService.assertPendingTokenHash(token);
    return {
      message: 'Invitation token validated successfully',
      tokenHash,
    };
  }

}