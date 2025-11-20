import { Controller, Post, Body, UseGuards, Get, Request, HttpCode, Res, Req, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Response, Request as ExpressRequest } from 'express';
import { UserRole } from '@prisma/client';
import { Roles } from './decorators/roles.decorator';
import { AuthenticationService } from './authentication.service';
import { UserInvitationService } from './userInvitation.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

interface AuthRequest extends ExpressRequest {
  user: {
    id: number;
    email?: string;
    role?: UserRole;
  };
  cookies: Record<string, string | undefined>;
}

@ApiTags('Authentication v1')
@ApiBearerAuth()
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthenticationController {
  constructor(
    private readonly authenticationService: AuthenticationService,
    private readonly invitationsService: UserInvitationService,
    private readonly configService: ConfigService,
  ) { }
  /**
   * Get cookie options based on environment
   */
  private getCookieOptions() {
    const env = this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV;
    const isProduction = env === 'production';
    const refreshHours = parseInt(this.configService.get<string>('REFRESH_EXPIRES_HOURS') || process.env.REFRESH_EXPIRES_HOURS || '8', 10);
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' as const : 'lax' as const, // Stricter in production
      maxAge: refreshHours * 60 * 60 * 1000, // configurable via REFRESH_EXPIRES_HOURS
      path: '/',
    };
  }

  /**
   * Clear the refresh token cookie safely
   */
  private clearRefreshTokenCookie(response: Response) {
    const cookieOptions = this.getCookieOptions();
    const clearOptions: Partial<typeof cookieOptions> = { ...cookieOptions };
    delete clearOptions.maxAge;
    response.clearCookie('refresh_token', clearOptions);
  }

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(200)
  @ApiOperation({
    summary: 'Complete user registration with invited token',
    description: 'Finalizes account creation using a valid invitation token hash. Users must first consume an invitation link to get the token hash. Requires only password - email and role are automatically assigned from the invitation. After successful registration, users must login separately to obtain authentication tokens. Rate limited to 3 attempts per minute for security.'
  })
  @ApiResponse({
    status: 200,
    description: 'Account created successfully - User must login separately',
    schema: {
      example: {
        message: 'Account created successfully - please login',
        user: {
          id: 5,
          email: 'newuser@example.com',
          role: 'MODERATOR',
          createdAt: '2025-10-28T12:00:00.000Z'
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid token, expired token, or password validation errors',
    schema: {
      examples: {
        invalidToken: {
          value: {
            statusCode: 400,
            message: 'Invalid invitation token'
          }
        },
        notConsumed: {
          value: {
            statusCode: 400,
            message: 'Please validate your invitation link first by visiting the invite URL'
          }
        },
        expired: {
          value: {
            statusCode: 400,
            message: 'This invitation link has expired. Please request a new invitation.'
          }
        },
        weakPassword: {
          value: {
            statusCode: 400,
            message: [
              'Password must contain at least one uppercase letter',
              'Password must contain at least one special character'
            ],
            error: 'Bad Request'
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 409,
    description: 'Account with this email already exists',
    schema: {
      example: {
        statusCode: 409,
        message: 'Account with this email already exists'
      }
    }
  })
  @ApiResponse({ status: 429, description: 'Too many requests - Rate limit: 3/minute' })
  async register(@Body() registerDto: RegisterDto) {
    return this.invitationsService.register(registerDto.tokenHash, registerDto.password);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(200)
  @ApiOperation({
    summary: 'Authenticate user with email and password',
    description: 'Authenticates existing users with their email and password credentials. On successful authentication, returns a JWT access token (15 minutes validity) in the response body and sets a secure refresh token (8 hours validity) as an HttpOnly cookie for automatic session management. The refresh token enables seamless token renewal without re-authentication. The 15-minute access token validity is a standard industry practice, balancing usability and security for workshop staff accessing administrative functions. Rate limited to 5 attempts per minute for security.'
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully authenticated - JWT token returned, refresh token set in cookie',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials - Email or password incorrect',
    schema: {
      example: {
        statusCode: 401,
        message: 'Invalid credentials'
      }
    }
  })
  @ApiResponse({ status: 429, description: 'Too many requests - Rate limit: 5/minute' })

  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) response: Response): Promise<{ access_token: string }> {
    const result = await this.authenticationService.login(loginDto);

    // Set refresh token in HttpOnly cookie
    response.cookie('refresh_token', result.refresh_token, this.getCookieOptions());

    // Return only the access token in the response body
    return { access_token: result.access_token };
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get authenticated user profile information',
    description: 'Returns the current authenticated user\'s profile data including ID, email, and role. This is a protected endpoint that requires a valid JWT access token in the Authorization header using Bearer authentication scheme. Used to verify authentication status and retrieve user details for the current session.'
  })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    schema: {
      example: {
        message: 'Profile accessed successfully',
        user: {
          id: 1,
          email: 'user@example.com',
          role: 'RESEARCHER',
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid JWT token',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized'
      }
    }
  })
  getProfile(@Request() req: AuthRequest): { message: string; user: { id: number; email?: string; role?: UserRole } } {
    return {
      message: 'Profile accessed successfully',
      user: req.user,
    };
  }

  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(200)
  @ApiOperation({
    summary: 'Refresh access token using refresh token',
    description: 'Exchanges a valid refresh token for a new JWT access token without requiring re-authentication. The refresh token must be provided via HttpOnly cookie (automatically sent by browser). Implements token rotation for enhanced security - each refresh generates both a new access token (15 min validity) and a new refresh token (8 hours validity), while invalidating the old refresh token. This enables seamless user sessions for workshop staff without password re-entry. Rate limited to 10 requests per minute.'
  })
  @ApiResponse({
    status: 200,
    description: 'New access token generated successfully',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token',
    schema: {
      example: {
        statusCode: 401,
        message: 'Invalid or expired refresh token'
      }
    }
  })
  @ApiResponse({ status: 429, description: 'Too many requests - Rate limit: 10/minute' })
  async refresh(@Req() request: AuthRequest, @Res({ passthrough: true }) response: Response): Promise<{ access_token: string; }> {

    const rawRefresh = request.cookies?.refresh_token;
    const refreshToken = typeof rawRefresh === 'string' ? rawRefresh : undefined;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found in cookies');
    }

    // Refresh tokens are hex-encoded 32 random bytes = 64 characters
    // Use proper validation to reject malformed tokens early
    if (refreshToken.length !== 64) {
      throw new BadRequestException('Invalid refresh token format');
    }

    // Additional format validation: hex should only contain [0-9a-f]
    if (!/^[0-9a-f]+$/.test(refreshToken)) {
      throw new BadRequestException('Invalid refresh token format');
    }

    const result = await this.authenticationService.refreshAccessToken(refreshToken, true);

    // Validate refresh token rotation succeeded
    if (!result.refresh_token) {
      throw new UnauthorizedException('Token refresh failed');
    }

    // Set new refresh token in cookie (token rotation)
    response.cookie('refresh_token', result.refresh_token, this.getCookieOptions());

    return {
      access_token: result.access_token
    };
  }

  @Post('logout')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // Rate limit: 10 requests per minute
  @HttpCode(200)
  @ApiOperation({
    summary: 'Logout from current session',
    description: 'Terminates the current user session by revoking the refresh token and clearing the session cookie. The refresh token is automatically extracted from the HttpOnly cookie and invalidated in the database to prevent reuse. Even if the token is invalid or expired, the cookie will still be cleared to ensure clean logout. This affects only the current session - other active sessions on different devices remain valid.'
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully logged out from current session',
    schema: {
      example: {
        message: 'Logged out successfully'
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'No refresh token found or invalid token',
    schema: {
      example: {
        statusCode: 401,
        message: 'Invalid or expired refresh token'
      }
    }
  })
  async logout(@Req() request: AuthRequest, @Res({ passthrough: true }) response: Response): Promise<{ message: string }> {
    const rawRefreshLogout = request.cookies?.refresh_token;
    const refreshLogoutToken = typeof rawRefreshLogout === 'string' ? rawRefreshLogout : undefined;

    if (refreshLogoutToken) {
      try {
        await this.authenticationService.revokeRefreshToken(refreshLogoutToken);
      } catch {
        // Even if token is invalid, we still clear the cookie
      }
    }

    // Clear the refresh token cookie (don't forward maxAge when clearing)
    this.clearRefreshTokenCookie(response);

    return {
      message: 'Logged out successfully'
    };
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // Rate limit: 5 requests per minute (more restrictive)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Logout from all sessions across all devices',
    description: 'Performs a global logout by revoking all active refresh tokens associated with the authenticated user across all devices and sessions. Requires a valid JWT access token for authentication. After execution, the user will be logged out from all devices including mobile apps, web browsers, and other clients. The current session cookie is also cleared. This is useful for security purposes when a user suspects account compromise or wants to ensure all devices are logged out.'
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully logged out from all sessions',
    schema: {
      example: {
        message: 'Logged out from all sessions successfully'
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid JWT token',
    schema: {
      example: {
        statusCode: 401,
        message: 'Unauthorized'
      }
    }
  })
  async logoutAll(@Request() req: AuthRequest, @Res({ passthrough: true }) response: Response): Promise<{ message: string }> {
    const userId = Number(req.user.id);

    // Revoke all refresh tokens for this user
    await this.authenticationService.revokeAllRefreshTokens(userId);

    // Clear the refresh token cookie (don't forward maxAge when clearing)
    this.clearRefreshTokenCookie(response);

    return {
      message: 'Logged out from all sessions successfully'
    };
  }
}