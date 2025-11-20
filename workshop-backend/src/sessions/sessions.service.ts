import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SessionsRepository } from './sessions.repository';
import { ParticipantsService } from '../participants/participants.service';
import { CreateSessionDto } from './dto/create.session.dto';
import { JoinSessionDto } from '../participants/dto/join.session.dto';
import { SessionStatus, UserRole } from '@prisma/client';
import { generateSessionCode } from '../common/util/session-code';
import { AuditLogService } from '../common/audit/audit.service';

/**
 * Workshop session with required properties for service operations.
 */
interface WorkshopSession {
  id: number;
  code: string;
  status: string;
  maxParticipants: number;
  createdById: number | null;
  createdAt: Date;
}

/**
 * Business logic for workshop sessions.
 */
@Injectable()
export class SessionsService {
  constructor(
    private readonly repository: SessionsRepository,
    private readonly participantsService: ParticipantsService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Creates a new workshop session with code generation and collision handling.
   */
  async createSession(createdById: number, dto: CreateSessionDto) {
    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
      const code = generateSessionCode();

      try {
        const session = await this.repository.createSession({
          code,
          createdById,
          maxParticipants: dto.maxParticipants,
        });

        try {
          await this.audit.logSessionCreated({ actorUserId: createdById, sessionId: session.id });
        } catch {
          // Do not block session creation on audit failure
        }

        return {
          id: session.id,
          code: session.code,
          status: session.status,
          maxParticipants: (session as WorkshopSession).maxParticipants,
          createdAt: session.createdAt,
        };
      } catch (error) {
        if (this.repository.isUniqueConstraintError(error)) {
          attempt++;
          if (attempt >= maxRetries) {
            throw new ConflictException(
              'Unable to generate unique session code after multiple attempts',
            );
          }
          // Continue to next attempt
          continue;
        }
        // Re-throw non-collision errors
        throw error;
      }
    }

    // This should never be reached due to the throw in the loop
    // throw new ConflictException('Session creation failed');
  }

  /**
   * Updates session status with business logic validation.
   */
  async updateSessionStatus(sessionId: number, newStatus: SessionStatus, userId: number) {
    // Verify ownership
    const session = await this.repository.findSessionForOwnerCheck(sessionId, userId);
    if (!session) {
      throw new NotFoundException('Session not found or access denied');
    }

    // Business logic for status transitions
    this.validateStatusTransition(session.status, newStatus);

    return await this.repository.updateSessionStatus(sessionId, newStatus);
  }

  /**
   * Gets detailed session information.
   */
  async getSessionDetails(sessionId: number, userId: number, userRole?: UserRole) {
    const session = await this.repository.findSessionById(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }


    // Check if user has access (owner or researcher)
    const hasAccess = session.createdById === userId || 
                     userRole === UserRole.RESEARCHER || 
                     userRole === UserRole.ADMIN;

    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return {
      id: session.id,
      code: session.code,
      status: session.status,
      maxParticipants: session.maxParticipants,
      participantCount: session._count.participants,
      createdAt: session.createdAt,
      createdBy: session.createdBy,
    };
  }

  /**
   * Joins a session by code with capacity and status validation.
   */
  
  // async joinByCode(dto: JoinSessionDto) {
  //   // Find session by normalized code
  //   const session = await this.repository.findByCode(dto.code);
  //   if (!session) {
  //     throw new NotFoundException('Session not found');
  //   }

  //   // Check session status
  //   if (session.status !== 'LOBBY') {
  //     throw new ForbiddenException('Session is not accepting new participants');
  //   }

  //   // Use transaction with the tx client directly
  //   const result = await this.repository.withTransaction(async (tx) => {
  //     // Count current participants using tx
  //     const participantCount = await tx.participant.count({
  //       where: { sessionId: session.id },
  //     });
      
  //     if (participantCount >= (session as WorkshopSession).maxParticipants) {
  //       throw new ForbiddenException('Session is full');
  //     }

  //     // Create participant using tx
  //     const participant = await tx.participant.create({
  //       data: {
  //         sessionId: session.id,
  //         colorHex: dto.colorHex,
  //         ...(dto.displayName && { displayName: dto.displayName }),
  //       },
  //     });

  //     // Generate token with hash
  //     const { token, tokenHash, expiresAt } = signParticipantToken({
  //       sessionId: session.id,
  //       participantId: participant.id,
  //     });

  //     // Create session token using tx
  //     await tx.sessionToken.create({
  //       data: {
  //         participantId: participant.id,
  //         tokenHash,
  //         expiresAt,
  //       },
  //     });

  //     return { participant, token, expiresAt };
  //   });

  //   return {
  //     token: result.token,
  //     participantId: result.participant.id,
  //     sessionId: session.id,
  //     code: session.code,
  //     displayName: result.participant.displayName,
  //     expiresAt: result.expiresAt.toISOString(),
  //   };
  // }

  async joinByCode(dto: JoinSessionDto) {
    const session = await this.repository.findByCode(dto.code);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.status !== 'LOBBY') {
      throw new ForbiddenException('Session is not accepting new participants');
    }

    const result = await this.participantsService.joinSession(session, dto);

    return {
      token: result.token,
      participantId: result.participant.id,
      sessionId: session.id,
      code: session.code,
      displayName: result.participant.displayName,
      expiresAt: result.expiresAt.toISOString(),
    };
  }

  /**
   * Gets all participants for a session with access control.
   */
  // async getSessionParticipants(sessionId: number, userId: number, userRole?: UserRole) {
  //   const session = await this.repository.findSessionById(sessionId);
  //   if (!session) {
  //     throw new NotFoundException('Session not found');
  //   }

  //   // Check if user has access (owner, researcher, or admin)
  //   const hasAccess = session.createdById === userId || 
  //                   userRole === UserRole.RESEARCHER || 
  //                   userRole === UserRole.ADMIN;

  //   if (!hasAccess) {
  //     throw new ForbiddenException('Access denied');
  //   }

  //   const participants = await this.repository.getSessionParticipants(sessionId);

  //   return participants.map(participant => ({
  //     id: participant.id,
  //     displayName: participant.displayName,
  //     colorHex: participant.colorHex,
  //     joinedAt: participant.joinedAt,
  //   }));
  // }

  async getSessionParticipants(sessionId: number, userId: number, userRole?: UserRole) {
  const session = await this.repository.findSessionById(sessionId);
  if (!session) {
    throw new NotFoundException('Session not found');
  }

  const hasAccess =
    session.createdById === userId ||
    userRole === UserRole.RESEARCHER ||
    userRole === UserRole.ADMIN;

  if (!hasAccess) {
    throw new ForbiddenException('Access denied');
  }

  return this.participantsService.getSessionParticipants(sessionId);
}

  /**
   * Allows participant to leave session using their token (LOBBY only).
   */
// async leaveSession(sessionId: number, participantToken: string): Promise<void> {
//   const tokenHash = createHash('sha256').update(participantToken).digest('hex');
  
//   await this.repository.withTransaction(async (tx) => {
    
//     // Find the participant associated with the token
//     const token = await this.repository.findParticipantByToken(tokenHash, sessionId);
//     if (!token || !token.participant) {
//       throw new ForbiddenException('Invalid or expired token');
//     }

//     // Ensure the session is in LOBBY
//     const session = await this.repository.findSessionById(sessionId);
//     if (!session || session.status !== 'LOBBY') {
//       throw new ForbiddenException('Cannot leave session unless it is in LOBBY');
//     }

//     // Revoke the session token
//     await this.repository.revokeSessionToken(tokenHash);

//     // Delete the participant
//     await this.repository.deleteParticipant(token.participant.id);
//   });

  
// }

async leaveSession(sessionId: number, participantToken: string): Promise<void> {
  const session = await this.repository.findSessionById(sessionId);
  if (!session || session.status !== 'LOBBY') {
    throw new ForbiddenException('Cannot leave session unless it is in LOBBY');
  }

  await this.participantsService.leaveSession(sessionId, participantToken);
}

  /**
   * Validates session status transitions according to business rules.
   */
  private validateStatusTransition(currentStatus: SessionStatus, newStatus: SessionStatus) {
    const validTransitions: Record<SessionStatus, SessionStatus[]> = {
      LOBBY: [SessionStatus.RUNNING, SessionStatus.ABANDONED],
      RUNNING: [SessionStatus.ENDED, SessionStatus.ABANDONED],
      ENDED: [], //  // No transitions from ended
      ABANDONED: [], // No transitions from abandoned
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new ForbiddenException(
        `Cannot transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  /**
   * Deletes or abandons a session (and its dependants)based on its current status.
   */
  async deleteOrAbandonSession(sessionId: number, moderatorUserId: number): Promise<void> {
    // Verify session exists and is owned by the moderator
    const session = await this.repository.findSessionForOwnerCheck(sessionId, moderatorUserId);
    if (!session) {
      throw new NotFoundException('Session not found or access denied');
    }

    if (session.status === SessionStatus.ENDED || session.status === SessionStatus.ABANDONED) {
      throw new ForbiddenException('Cannot delete a session that has ended or been abandoned');
    }

    await this.repository.withTransaction(async (tx) => {
      
      // Revoke all participant session tokens (do this first to invalidate access) - TODO
  
      if (session.status === SessionStatus.LOBBY) {
       
        // LOBBY: remove all participant data + drafts, then the session row (code becomes unusable)
        await this.repository.deleteAllParticipants(sessionId, tx);
        await this.repository.deleteAllBmcDrafts(sessionId, tx);
        await this.repository.deleteSessionRow(sessionId, tx);

      } else if (session.status === SessionStatus.RUNNING) {
        
        // RUNNING: remove only participant data and mark session ABANDONED
        await this.repository.deleteAllParticipants(sessionId, tx);

        // Keep BMC profiles, rounds and session; just disable future access
        await this.repository.updateSessionStatusTx(sessionId, SessionStatus.ABANDONED, tx);

      }
    });
  }

}