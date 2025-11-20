import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogType, Prisma, UserRole } from '@prisma/client';

type TxClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  private client(tx?: Prisma.TransactionClient): TxClient {
    return tx ?? this.prisma;
  }

  /**
   * Low-level: create any AuditLog row by mapping directly to columns.
   * Only set fields that make sense for the event type; others stay null.
   */
  async createAuditLog(
    data: {
      type: AuditLogType;
      actorUserId?: number | null;
      targetUserId?: number | null;
      sessionId?: number | null;
      scenarioId?: number | null;
      invitationId?: number | null;
      previousRole?: UserRole | null;
      newRole?: UserRole | null;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.client(tx);
    return client.auditLog.create({ data });
  }

  /**
   * USER_ROLE_CHANGED
   */
  async logUserRoleChanged(
    params: {
      actorUserId: number;
      targetUserId: number;
      previousRole: UserRole;
      newRole: UserRole;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.client(tx);
    return client.auditLog.create({
      data: {
        type: AuditLogType.USER_ROLE_CHANGED,
        actorUserId: params.actorUserId,
        targetUserId: params.targetUserId,
        previousRole: params.previousRole,
        newRole: params.newRole,
      },
    });
  }

  /**
   * SESSION_CREATED
   */
  async logSessionCreated(
    params: {
      actorUserId: number;
      sessionId: number;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.client(tx);
    return client.auditLog.create({
      data: {
        type: AuditLogType.SESSION_CREATED,
        actorUserId: params.actorUserId,
        sessionId: params.sessionId,
      },
    });
  }

  /**
   * SCENARIO_SELECTED
   */
  async logScenarioSelected(
    params: {
      actorUserId: number;
      sessionId: number;
      scenarioId: number;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const client = this.client(tx);
    return client.auditLog.create({
      data: {
        type: AuditLogType.SCENARIO_SELECTED,
        actorUserId: params.actorUserId,
        sessionId: params.sessionId,
        scenarioId: params.scenarioId,
      },
    });
  }

  /**
   * USER_INVITATION_EVENT
   * Use when creating/consuming/accepting invitations; fill IDs as available.
   */
 
  // Invitation lifecycle events
  async logInvitationCreated(params: { actorUserId: number; invitationId: number }, tx?: TxClient) {
    return this.client(tx).auditLog.create({
      data: {
        type: AuditLogType.INVITATION_CREATED,
        actorUserId: params.actorUserId,
        invitationId: params.invitationId,
      },
    });
  }

  async logInvitationConsumed(params: { invitationId: number }, tx?: TxClient) {
    return this.client(tx).auditLog.create({
      data: {
        type: AuditLogType.INVITATION_CONSUMED,
        invitationId: params.invitationId,
      },
    });
  }

  async logInvitationAccepted(params: { invitationId: number; targetUserId: number }, tx?: TxClient) {
    return this.client(tx).auditLog.create({
      data: {
        type: AuditLogType.INVITATION_ACCEPTED,
        invitationId: params.invitationId,
        targetUserId: params.targetUserId,
      },
    });
  }

  async logInvitationExpired(params: { invitationId: number }, tx?: TxClient) {
    return this.client(tx).auditLog.create({
      data: {
        type: AuditLogType.INVITATION_EXPIRED,
        invitationId: params.invitationId,
      },
    });
  }
}
