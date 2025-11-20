import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthenticationModule } from './authentication/authentication.module';
import { SessionsModule } from './sessions/sessions.module';
import { ParticipantsModule } from './participants/participants.module';
import { EmailModule } from './email/email.module';
import { CleanupService } from './common/util/cleanup.service';
import { UsersModule } from './users/users.module';
import { ScenariosModule } from './scenarios/scenarios.module';


@Module({
  imports: [
    AuthenticationModule,
    SessionsModule,
    ParticipantsModule,
    EmailModule,
    UsersModule,
    ScenariosModule,
  // ScheduleModule provides cron/interval decorators for background jobs
  ScheduleModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }), // loads .env
    ThrottlerModule.forRoot([
      {
        ttl: 60000, 
        limit: 10,  
      },
    ]),
  ],
  providers: [CleanupService],
})
export class AppModule { }
