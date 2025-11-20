import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuthenticationService } from '../../authentication/authentication.service';
import { ParticipantsService } from '../../participants/participants.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    private readonly authService: AuthenticationService,
    private readonly participantsService: ParticipantsService,
  ) {}

  // Run once every day at 02:00 AM server time
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDailyCleanup() {
    this.logger.log('Starting daily cleanup of expired and revoked tokens');
    try {
      // Cleanup authentication refresh tokens
      await this.authService.cleanupTokens();
      this.logger.log('Refresh token cleanup completed successfully');
      
      // Cleanup session tokens
      await this.participantsService.cleanupSessionTokens();
      this.logger.log('Session token cleanup completed successfully');
    } catch (error) {
      this.logger.error('Error during token cleanup', error);
    }
  }
}
