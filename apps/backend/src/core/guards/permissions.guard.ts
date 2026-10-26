import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_ROLE_KEY } from '../decorators/require-role.decorator';
import { AuthenticatedUser } from '../../types/express.js';

interface RequestWithUser {
  user?: Pick<AuthenticatedUser, 'isAuthority'>;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // @RequireRole(...roles) stores its arguments as an array, never a string.
    const requiredRoles = this.reflector.getAllAndOverride<
      string[] | undefined
    >(REQUIRE_ROLE_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredRoles?.length) return true;

    const { user } = context.switchToHttp().getRequest<RequestWithUser>();
    if (requiredRoles.includes('authority') && !user?.isAuthority) {
      throw new ForbiddenException();
    }

    return true;
  }
}
