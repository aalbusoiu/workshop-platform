import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';

/**
 * Email Module
 * 
 * Provides email sending functionality using Postmark.
 * Exports EmailService for use in other modules (e.g., Authentication).
 */
@Module({
  imports: [ConfigModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
