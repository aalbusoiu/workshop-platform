import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { InvitationStatus } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserRole } from '@prisma/client';
import { AuditLogService } from '../common/audit/audit.service';

@Injectable()
export class UserInvitationService {
   constructor(
     private prisma: PrismaService,
     private emailService: EmailService,
     private configService: ConfigService,
     private audit: AuditLogService,
   ) {}
 
  private generateRegisterToken(): { rawToken: string; tokenHash: string } {
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    return { rawToken, tokenHash };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Check if invitation token has expired based on createdAt timestamp
   */
  private isInvitationExpired(createdAt: Date): boolean {
    const expirationHours = Number(this.configService.get<string>('INVITE_EXPIRATION_HOURS') ?? '24');
    const expirationMs = expirationHours * 60 * 60 * 1000;
    const expiresAt = new Date(createdAt.getTime() + expirationMs);
    return new Date() > expiresAt;
  }

  /**
   * Validate raw token and mark as consumed (one-time use).
   * Returns the tokenHash if valid.
   */
  async assertPendingTokenHash(rawToken: string): Promise<string> {
    // Use proper validation to reject malformed tokens early
    if (!rawToken || rawToken.length !== 43) {
      throw new BadRequestException('Invalid invitation token format');
    }

    // Additional format validation: base64url should only contain [A-Za-z0-9_-]
    if (!/^[A-Za-z0-9_-]+$/.test(rawToken)) {
      throw new BadRequestException('Invalid invitation token format');
    }

    const tokenHash = this.hashToken(rawToken);
    
    // Read the invitation first to provide helpful error messages.
    const invite = await this.prisma.userInvitation.findUnique({
      where: { tokenHash },
      select: { id: true, status: true, createdAt: true },
    });

    if (!invite) {
      throw new BadRequestException('Invalid invitation token');
    }

    // Check if token has expired
    if (this.isInvitationExpired(invite.createdAt)) {
      await this.audit.logInvitationExpired({ invitationId: invite.id }); // log expiration event
      throw new BadRequestException('This invitation link has expired. Please request a new invitation.');
    }
    
    // Only PENDING invites can be consumed
    if (invite.status !== InvitationStatus.PENDING) {
      if (invite.status === InvitationStatus.CONSUMED) {
        throw new BadRequestException('This invitation link has already been used once.');
      }
      throw new BadRequestException('This invitation is no longer valid');
    }
    
    // Mark as consumed (one-time use) using conditional update to avoid races.
    const updated = await this.prisma.userInvitation.updateMany({
      where: { id: invite.id, status: InvitationStatus.PENDING },
      data: { status: InvitationStatus.CONSUMED },
    });

    if (updated.count === 0) {
      // Another request may have consumed this token already.
      throw new BadRequestException('This invitation link has already been used once.');
    }

    await this.audit.logInvitationConsumed({ invitationId: invite.id });

    return tokenHash;
  }

  async createInvite(createInviteDto: CreateInviteDto, adminId: number) {
    const { email, role } = createInviteDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Check for existing non-expired pending invitation; allow new invite if previous is expired
    const existingInvite = await this.prisma.userInvitation.findFirst({
      where: {
        email,
        status: InvitationStatus.PENDING,
      },
    });

    if (existingInvite && !this.isInvitationExpired(existingInvite.createdAt)) {
      throw new ConflictException('A pending invitation already exists for this email');
    }
    
    const { rawToken, tokenHash } = this.generateRegisterToken();

    const invitation = await this.prisma.userInvitation.create({
      data: {
        email,
        role,
        tokenHash,
        createdById: adminId,
      },
    });

    // Send invitation email
    try {
      await this.emailService.sendInvitationEmail(email, rawToken, role);

      await this.audit.logInvitationCreated({ actorUserId: adminId, invitationId: invitation.id });

    } catch (error) {
      // If email fails, delete the invitation and throw error
      await this.prisma.userInvitation.delete({ where: { id: invitation.id } });
      throw error;
    }

    const response: {
      message: string;
      invitation: { id: number; email: string; role: UserRole; createdAt: Date };
      devToken?: string;
    } = {
      message: `Invitation sent successfully to ${email}`,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        createdAt: invitation.createdAt,
      },
    };

    // Only include token in development for testing (when email is disabled)
    const env = this.configService.get<string>('NODE_ENV') ?? process.env.NODE_ENV ?? 'development';
    const emailEnabled = this.configService.get<string>('EMAIL_ENABLED') ?? process.env.EMAIL_ENABLED ?? 'true';
    
    // Extra safety: only expose devToken in explicit development mode
    if (env === 'development' && emailEnabled === 'false') {
      response.devToken = rawToken;
    }

    return response;
  }

  /**
   * Register a new user account using a validated invitation token hash.
   */
  async register(tokenHash: string, password: string) {
    return await this.prisma.$transaction(async (tx) => {
      const invitation = await tx.userInvitation.findUnique({ where: { tokenHash } });
      
      if (!invitation) {
        throw new BadRequestException('Invalid invitation token');
      }

      // Check if token has expired
      if (this.isInvitationExpired(invitation.createdAt)) {
        throw new BadRequestException('This invitation link has expired. Please request a new invitation.');
      }
      
      // Must be CONSUMED (after validation) to register
      if (invitation.status !== InvitationStatus.CONSUMED) {
        if (invitation.status === InvitationStatus.PENDING) {
          throw new BadRequestException('Please validate your invitation link first by visiting the invite URL');
        }
        throw new BadRequestException('This invitation has already been used or is no longer valid');
      }

      const existingUser = await tx.user.findUnique({ where: { email: invitation.email } });
      if (existingUser) {
        throw new ConflictException('Account with this email already exists');
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await tx.user.create({
        data: { email: invitation.email, passwordHash, role: invitation.role },
      });

      await tx.userInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.ACCEPTED },
      });

      await this.audit.logInvitationAccepted(
        {
          invitationId: invitation.id,
          targetUserId: user.id,
        },
        tx,
      );
      return {
        message: 'Account created successfully - please login',
        user: { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt },
      };
    });
  }
}
