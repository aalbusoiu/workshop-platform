import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthenticationController } from './authentication.controller';
import { InvitationsController } from './invitations.controller';
import { AuthenticationService } from './authentication.service';
import { AuthenticationRepository } from './authentication.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { UserInvitationService } from './userInvitation.service';
import { EmailModule } from '../email/email.module';
import { AuditModule } from '../common/audit/audit.module';

/**
 * Authentication Module
 * 
 * Handles user authentication, JWT token management, and role-based access control.
 * Provides secure login, registration, and user profile management.
 */
@Module({
  imports: [
    PassportModule,
    EmailModule,
    // Ensure consistent JWT config via ConfigModule
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        const jwtExpires = config.get<string>('JWT_EXPIRES_IN') || '15m';
        return {
          secret,
          signOptions: {
            expiresIn: jwtExpires, // configurable via JWT_EXPIRES_IN
          },
        };
      },
    }),
    AuditModule,
    
  ],
  controllers: [AuthenticationController, InvitationsController],
  providers: [AuthenticationService, AuthenticationRepository, UserInvitationService, JwtStrategy, PrismaService],
  exports: [AuthenticationService, UserInvitationService],
})
export class AuthenticationModule {}