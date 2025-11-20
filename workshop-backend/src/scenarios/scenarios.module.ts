import { Module } from '@nestjs/common';
import { ScenariosController } from './scenarios.controller';
import { ScenariosService } from './scenarios.service';
import { ScenariosRepository } from './scenarios.repository';
import { PrismaService } from '../prisma/prisma.service';
import { AuditModule } from '../common/audit/audit.module';
import { AuthenticationModule } from '../authentication/authentication.module';

/**
 * NestJS module that wires together the scenarios controller, service and repository,
 * and imports shared infrastructure needed for authentication and audit logging.
 */
@Module({
  imports: [AuthenticationModule, AuditModule],
  controllers: [ScenariosController],
  providers: [ScenariosService, ScenariosRepository, PrismaService],
  exports: [ScenariosService],
})
export class ScenariosModule {}