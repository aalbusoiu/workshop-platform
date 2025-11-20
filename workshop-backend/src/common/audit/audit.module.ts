import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from './audit.service';

@Module({
  providers: [AuditLogService, PrismaService],
  exports: [AuditLogService],
})
export class AuditModule {}