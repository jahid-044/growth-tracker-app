import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AuthService } from '../../auth.service';
import { JwtStrategy } from '../jwt.strategy';

const mockConfigService = {
  getOrThrow: jest.fn().mockReturnValue('test-jwt-secret'),
};

const mockAuthService = {
  resolveTokenUser: jest.fn(),
};

const payload = {
  sub: 'uuid-1',
  email: 'alice@dsinnovators.com',
  isAuthority: true,
  typ: 'access' as const,
  ver: 0,
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('validate returns the user as the database has them now', async () => {
    // The token still claims authority; the database has since revoked it.
    mockAuthService.resolveTokenUser.mockResolvedValue({
      id: 'uuid-1',
      email: 'alice@dsinnovators.com',
      isAuthority: false,
      tokenVersion: 0,
    });

    const result = await strategy.validate(payload);

    expect(mockAuthService.resolveTokenUser).toHaveBeenCalledWith(
      payload,
      'access',
    );
    expect(result).toEqual({
      userId: 'uuid-1',
      email: 'alice@dsinnovators.com',
      isAuthority: false,
    });
  });

  it('validate rejects a refresh, revoked or orphaned token', async () => {
    mockAuthService.resolveTokenUser.mockResolvedValue(null);

    await expect(
      strategy.validate({ ...payload, typ: 'refresh' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
