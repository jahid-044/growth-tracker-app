import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService, type TokenPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Only an unrevoked access token gets through, and `isAuthority` comes from
   * the database, not the token — so a demotion takes effect on the next
   * request instead of when the token expires.
   */
  async validate(payload: TokenPayload) {
    const user = await this.authService.resolveTokenUser(payload, 'access');
    if (!user) throw new UnauthorizedException();
    return {
      userId: user.id,
      email: user.email,
      isAuthority: user.isAuthority ?? false,
    };
  }
}
