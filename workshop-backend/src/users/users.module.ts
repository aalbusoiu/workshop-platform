import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticationModule } from '../authentication/authentication.module';
import { AuditModule } from '../common/audit/audit.module';

@Module({
  imports: [AuthenticationModule, AuditModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, PrismaService],
  exports: [UsersService],
})
export class UsersModule {}
