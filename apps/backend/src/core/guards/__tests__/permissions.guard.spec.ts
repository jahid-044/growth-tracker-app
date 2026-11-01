import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtStrategy } from '../../../modules/auth/strategies/jwt.strategy';
import { RequireRole } from '../../decorators/require-role.decorator';
import { PermissionsGuard } from '../permissions.guard';

// Real decorators and a real Reflector: the metadata the guard reads is exactly
// what @RequireRole() writes in production.
class RoutesController {
  @RequireRole('authority')
  authorityOnly() {}

  open() {}
}

@RequireRole('authority')
class AuthorityController {
  anything() {}
}

// The request user is whatever JwtStrategy.validate() returns, so build it
// through the strategy instead of hand-writing its shape.
const strategy = new JwtStrategy({
  getOrThrow: () => 'test-jwt-secret',
} as unknown as ConfigService);
const member = strategy.validate({
  sub: 'uid-member',
  email: 'member@dsinnovators.com',
  isAuthority: false,
});
const authority = strategy.validate({
  sub: 'uid-authority',
  email: 'authority@dsinnovators.com',
  isAuthority: true,
});

const makeContext = (
  controller: new () => object,
  handler: string,
  user: object | undefined,
) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () =>
      (controller.prototype as Record<string, () => void>)[handler],
    getClass: () => controller,
  }) as unknown as ExecutionContext;

describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());

  it('throws 403 for a member on an @RequireRole("authority") handler', () => {
    expect(() =>
      guard.canActivate(makeContext(RoutesController, 'authorityOnly', member)),
    ).toThrow(ForbiddenException);
  });

  it('allows an authority through an @RequireRole("authority") handler', () => {
    expect(
      guard.canActivate(
        makeContext(RoutesController, 'authorityOnly', authority),
      ),
    ).toBe(true);
  });

  it('throws 403 when there is no user on an authority-only route', () => {
    expect(() =>
      guard.canActivate(
        makeContext(RoutesController, 'authorityOnly', undefined),
      ),
    ).toThrow(ForbiddenException);
  });

  it('applies class-level @RequireRole("authority")', () => {
    expect(() =>
      guard.canActivate(makeContext(AuthorityController, 'anything', member)),
    ).toThrow(ForbiddenException);
    expect(
      guard.canActivate(
        makeContext(AuthorityController, 'anything', authority),
      ),
    ).toBe(true);
  });

  it('passes through when no @RequireRole() metadata is set', () => {
    expect(
      guard.canActivate(makeContext(RoutesController, 'open', member)),
    ).toBe(true);
  });
});
