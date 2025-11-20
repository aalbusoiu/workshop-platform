import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards, Request, Get, Param, Patch, ParseIntPipe, NotFoundException, Delete } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { CreateSessionDto } from './dto/create.session.dto';
import { JoinSessionDto } from '../participants/dto/join.session.dto';
import { JwtAuthGuard } from '../authentication/guards/jwt-auth.guard';
import { RolesGuard } from '../authentication/guards/roles.guard';
import { Roles } from '../authentication/decorators/roles.decorator';
import { UserRole, SessionStatus } from '@prisma/client';
import { ApiBody } from '@nestjs/swagger';
import { LeaveSessionDto } from '../participants/dto/leave.session.dto';
import { UpdateSessionStatusDto } from './dto/update.session.status.dto';

interface AuthenticatedRequest extends Request {
  user: {
    id: number;
    email: string;
    role: UserRole;
  };
}

@ApiTags('Sessions v1')
@Controller({
  path: 'sessions',
  version: '1'
})
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new session (Moderators only)' })
  @ApiResponse({ status: 201, description: 'Session created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - JWT token required' })
  @ApiResponse({ status: 403, description: 'Forbidden - Moderator role required' })
  async create(@Body() dto: CreateSessionDto, @Request() req: AuthenticatedRequest) {
    const createdById: number = req.user.id; // Get authenticated user ID
    const session = await this.sessionsService.createSession(createdById, dto);
    if (!session) {
      throw new NotFoundException('Session could not be created');
    }
    return {
      id: session.id,
      code: session.code,
      status: session.status,
      maxParticipants: session.maxParticipants,
      createdAt: session.createdAt,
    };
  }

  @Post('join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join a session by code (Public endpoint)' })
  @ApiResponse({ status: 200, description: 'Successfully joined session and token issued' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 403, description: 'Session is full or not accepting participants' })
  async join(@Body() dto: JoinSessionDto) {
    const result = await this.sessionsService.joinByCode(dto);
    return {
      participantId: result.participantId,
      sessionId: result.sessionId,
      token: result.token,
      expiresAt: result.expiresAt,
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.RESEARCHER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get session details (Moderators, Researchers, Admins)' })
  @ApiResponse({ status: 200, description: 'Session details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getSession(@Param('id', ParseIntPipe) sessionId: number, @Request() req: AuthenticatedRequest) {
    return await this.sessionsService.getSessionDetails(sessionId, req.user.id, req.user.role);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update session status (Session owners and Admins only)' })
  @ApiResponse({ status: 200, description: 'Session status updated successfully' })
  @ApiResponse({ status: 404, description: 'Session not found or access denied' })
  @ApiResponse({ status: 403, description: 'Invalid status transition' })
  async updateStatus(
    @Param('id', ParseIntPipe) sessionId: number,
    @Body() dto: UpdateSessionStatusDto,
    @Request() req: AuthenticatedRequest
  ) {
    const updatedSession = await this.sessionsService.updateSessionStatus(sessionId, dto.status, req.user.id);
    return {
      id: updatedSession.id,
      status: updatedSession.status,
      code: updatedSession.code,
    };
  }


  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete or abandon a session (Moderator owner)' })
  @ApiResponse({ status: 204, description: 'Session deleted/abandoned successfully' })
  @ApiResponse({ status: 404, description: 'Session not found or access denied' })
  @ApiResponse({ status: 403, description: 'Forbidden (invalid session status or not owner)' })
  async deleteSession(
    @Param('id', ParseIntPipe) sessionId: number,
    @Request() req: AuthenticatedRequest
  ): Promise<void> {
    await this.sessionsService.deleteOrAbandonSession(sessionId, req.user.id);
  }


  //participant endpoints

  @Get(':id/participants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.RESEARCHER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get session participants (Moderators, Researchers, Admins)' })
  @ApiResponse({ status: 200, description: 'Participants retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getSessionParticipants(@Param('id', ParseIntPipe) sessionId: number, @Request() req: AuthenticatedRequest) {
    return await this.sessionsService.getSessionParticipants(sessionId, req.user.id, req.user.role);
  }

  @Post(':sessionId/leave')
  @ApiOperation({ summary: 'Leave session' })
  @ApiResponse({ status: 200, description: 'Successfully left session' })
  @ApiResponse({ status: 403, description: 'Invalid token or session not in LOBBY' })
  async leaveSession(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: LeaveSessionDto
  ) {
    return await this.sessionsService.leaveSession(sessionId, dto.token);
  }

}