import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../../../types/express.js';
import { JwtAuthGuard } from '../jwt-auth.guard';

jest.mock('@nestjs/passport', () => ({
  AuthGuard: jest.fn().mockImplementation(() => {
    return class MockPassportBase {
      canActivate(): Promise<boolean> {
        return Promise.resolve(true);
      }
    };
  }),
}));

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;

  const mockRequest: {
    headers: Record<string, unknown>;
    user?: AuthenticatedUser;
  } = {
    headers: {},
  };

  const parentProto = Object.getPrototypeOf(JwtAuthGuard.prototype) as {
    canActivate: (ctx: ExecutionContext) => Promise<boolean>;
  };

  const makeContext = () =>
    ({
      switchToHttp: () => ({ getRequest: () => mockRequest }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    guard = new JwtAuthGuard(reflector);
    mockRequest.user = undefined;
  });

  afterEach(() => jest.restoreAllMocks());

  it('passes when valid JWT in Authorization header', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    mockRequest.user = { id: 'user-1', isAuthority: false };

    jest.spyOn(parentProto, 'canActivate').mockResolvedValue(true);

    const result = await guard.canActivate(makeContext());

    expect(result).toBe(true);
    expect(mockRequest.user).toBeDefined();
  });

  it('throws 401 when token is malformed or expired', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    jest
      .spyOn(parentProto, 'canActivate')
      .mockRejectedValue(new UnauthorizedException('jwt expired'));

    await expect(guard.canActivate(makeContext())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('bypasses auth for @Public() routes', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    const superSpy = jest.spyOn(parentProto, 'canActivate');

    const result = await guard.canActivate(makeContext());

    expect(result).toBe(true);
    expect(superSpy).not.toHaveBeenCalled();
  });

  it('throws 401 when Authorization header is absent', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);

    jest
      .spyOn(parentProto, 'canActivate')
      .mockRejectedValue(new UnauthorizedException());

    await expect(guard.canActivate(makeContext())).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
