import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import { Public } from '../../core/decorators/public.decorator';
import { AuthService } from './auth.service';

interface AuthenticatedUser {
  userId: string;
  email: string;
  isAuthority: boolean;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @UseGuards(AuthGuard('google'))
  @Get('google')
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  googleLogin() {
    // Passport handles the redirect
  }

  @Public()
  @UseGuards(AuthGuard('google'))
  @Get('google/callback')
  @ApiOperation({
    summary: 'Google OAuth callback — redirects to frontend with tokens',
  })
  googleCallback(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    if (!user) {
      return res.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
    const { accessToken, refreshToken } = this.authService.generateTokens(
      user as unknown as {
        id: string;
        email: string;
        isAuthority: boolean | null;
        tokenVersion: number;
      },
    );
    return res.redirect(
      `${frontendUrl}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`,
    );
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.userId);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({ schema: { example: { refreshToken: 'your-refresh-token' } } })
  refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshAccessToken(body.refreshToken);
  }

  @ApiBearerAuth()
  @Post('logout')
  @ApiOperation({
    summary: 'Logout — revokes every token issued to the current user',
  })
  async logout(@CurrentUser() user: AuthenticatedUser) {
    await this.authService.revokeTokens(user.userId);
    return { message: 'Logged out' };
  }
}
