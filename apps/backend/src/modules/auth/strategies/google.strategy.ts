import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID') ?? '',
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') ?? '',
      // TODO: move to ConfigService
      callbackURL:
        config.get<string>('GOOGLE_CALLBACK_URL') ??
        'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: {
      emails: { value: string }[];
      displayName: string;
      photos: { value: string }[];
    },
    done?: VerifyCallback,
  ) {
    const email = profile.emails[0].value;
    const allowedDomains = (
      this.config.get<string>('ALLOWED_EMAIL_DOMAINS') ?? ''
    )
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean);
    if (
      allowedDomains.length > 0 &&
      !allowedDomains.some((domain) => email.endsWith(`@${domain}`))
    ) {
      throw new UnauthorizedException('Email domain not allowed');
    }
    const user = await this.authService.upsertUser({
      email,
      name: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value ?? null,
    });
    if (done) done(null, user);
    return user;
  }
}
