import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { ParticipantsRepository } from './participants.repository';
import { JoinSessionDto } from './dto/join.session.dto';
import { signParticipantToken } from './participant-token';

interface SessionForParticipants {
  id: number;
  code: string;
  status: string;
  maxParticipants: number;
}

@Injectable()
export class ParticipantsService {
  constructor(private readonly repository: ParticipantsRepository) {}

  async joinSession(session: SessionForParticipants, dto: JoinSessionDto) {
    return this.repository.withTransaction(async (tx) => {
      const participantCount = await this.repository.countParticipants(
        session.id,
        tx,
      );

      if (participantCount >= session.maxParticipants) {
        throw new ForbiddenException('Session is full');
      }

      const participant = await this.repository.createParticipant(
        {
          sessionId: session.id,
          colorHex: dto.colorHex,
          displayName: dto.displayName,
        },
        tx,
      );

      const { token, tokenHash, expiresAt } = signParticipantToken({
        sessionId: session.id,
        participantId: participant.id,
      });

      await this.repository.createSessionToken(
        {
          participantId: participant.id,
          tokenHash,
          expiresAt,
        },
        tx,
      );

      return { participant, token, expiresAt };
    });
  }

  async getSessionParticipants(sessionId: number) {
    const participants = await this.repository.getSessionParticipants(sessionId);

    return participants.map((participant) => ({
      id: participant.id,
      displayName: participant.displayName,
      colorHex: participant.colorHex,
      joinedAt: participant.joinedAt,
    }));
  }

  async leaveSession(sessionId: number, participantToken: string): Promise<void> {
    const tokenHash = createHash('sha256')
      .update(participantToken)
      .digest('hex');

    await this.repository.withTransaction(async (tx) => {
      const tokenRecord = await this.repository.findParticipantByToken(
        tokenHash,
        sessionId,
        tx,
      );

      if (!tokenRecord || !tokenRecord.participant) {
        throw new ForbiddenException('Invalid or expired token');
      }

      await this.repository.revokeSessionToken(tokenHash, tx);
      await this.repository.deleteParticipant(tokenRecord.participant.id, tx);
    });
  }

  /**
   * Cleanup expired and revoked session tokens (can be called periodically)
   */
  async cleanupSessionTokens() {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    await this.repository.cleanupExpiredSessionTokens(oneDayAgo);
  }
}
