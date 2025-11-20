import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

/**
 * Email Service using Gmail SMTP
 * 
 * Handles sending transactional emails via Gmail's SMTP server.
 * Currently supports invitation emails with plans for password reset, welcome emails, etc.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;
  private emailFrom: string;
  private emailFromName: string;
  private frontendUrl: string;
  private emailEnabled: boolean;

  constructor(private configService: ConfigService) {
    // Get configuration from environment
    const gmailUser = this.configService.get<string>('GMAIL_USER');
    const gmailAppPassword = this.configService.get<string>('GMAIL_APP_PASSWORD');
    this.emailFrom = this.configService.get<string>('EMAIL_FROM') || gmailUser || 'noreply@example.com';
    this.emailFromName = this.configService.get<string>('EMAIL_FROM_NAME') || 'Workshop Platform';
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    this.emailEnabled = this.configService.get<string>('EMAIL_ENABLED') !== 'false';

    // Initialize Gmail SMTP transporter
    if ((!gmailUser || !gmailAppPassword) && this.emailEnabled) {
      this.logger.warn('Gmail credentials not found - email sending will be disabled');
      this.emailEnabled = false;
    } else if (this.emailEnabled && gmailUser && gmailAppPassword) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailAppPassword,
        },
      });
      this.logger.log('Gmail SMTP email service initialized');
    }
  }

  /**
   * Send invitation email to a new user
   */
  async sendInvitationEmail(to: string, token: string, role: string): Promise<void> {
    if (!this.emailEnabled) {
      this.logger.warn(`Email disabled - would have sent invitation to ${to}`);
      return;
    }

    const invitationLink = `${this.frontendUrl}/register?token=${token}`;
    const expirationHours = this.configService.get<string>('INVITE_EXPIRATION_HOURS') || '24';

    try {
      const rawResult: unknown = await this.transporter.sendMail({
        from: `"${this.emailFromName}" <${this.emailFrom}>`,
        to: to,
        subject: 'Invitation to Workshop Platform',
        text: this.buildInvitationTextEmail(role, invitationLink, expirationHours),
      });
      // Safely extract messageId from unknown result
      let messageId = '';
      if (rawResult && typeof rawResult === 'object' && 'messageId' in rawResult) {
        messageId = String((rawResult as Record<string, unknown>)['messageId']);
      }
      this.logger.log(`Invitation email sent to ${to} - MessageID: ${messageId}`);
    } catch (error) {
      const err = error as { code?: string; responseCode?: number };
      this.logger.error(`Failed to send invitation email to ${to}`, err);

      // Handle common SMTP errors
      if (err.code === 'EAUTH') {
        throw new InternalServerErrorException('Gmail authentication failed - check your app password');
      } else if (err.code === 'EENVELOPE') {
        throw new InternalServerErrorException('Invalid email address format');
      } else if (err.responseCode === 550) {
        throw new InternalServerErrorException('Recipient email address rejected');
      } else {
        throw new InternalServerErrorException('Failed to send invitation email');
      }
    }
  }

  /**
   * Build plain text invitation email content
   */
  private buildInvitationTextEmail(role: string, link: string, expirationHours: string): string {
    return `Hello,

You've been invited to join the Workshop Platform as a ${role}.

Click the link below to complete your registration:
${link}

This invitation will expire in ${expirationHours} hours.

If you didn't expect this invitation, you can safely ignore this email.

Best regards,
RGBI Team`;
  }
}
