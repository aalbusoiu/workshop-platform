import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticationService } from '../authentication.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authenticationService: AuthenticationService,
    private configService: ConfigService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: { sub: string | number; [key: string]: any }) {
    const user = await this.authenticationService.validateUser(String(payload.sub));
    if (!user) {
      throw new UnauthorizedException();
    }

    // For prototype: Check if user has any active refresh tokens
    // If no active tokens exist, user has been logged out from all sessions
    const activeTokens = await this.authenticationService.getActiveTokensForUser(user.id);
    if (activeTokens.length === 0) {
      throw new UnauthorizedException('All sessions have been revoked');
    }

    return user;
  }
}