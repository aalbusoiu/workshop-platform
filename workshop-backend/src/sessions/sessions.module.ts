import { Module } from '@nestjs/common';
import {SessionsController} from './sessions.controller';
import { SessionsService } from './sessions.service';
import { SessionsRepository } from './sessions.repository';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticationModule } from '../authentication/authentication.module';
import { ParticipantsModule } from '../participants/participants.module';
import { AuditModule } from '../common/audit/audit.module';

@Module({
  imports: [AuthenticationModule, ParticipantsModule, AuditModule],
  controllers: [SessionsController],
  providers: [SessionsService, SessionsRepository, PrismaService],
  exports: [SessionsService],
})
export class SessionsModule {}