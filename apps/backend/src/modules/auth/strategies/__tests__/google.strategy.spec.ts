import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AuthService } from '../../auth.service';
import { GoogleStrategy } from '../google.strategy';

const mockAuthService = {
  upsertUser: jest.fn(),
};

let config: Record<string, string>;

const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: string) => {
    return config[key] ?? defaultValue;
  }),
};

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;

  beforeEach(async () => {
    jest.clearAllMocks();
    config = {
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      ALLOWED_EMAIL_DOMAINS: 'dsinnovators.com',
    };
    const module = await Test.createTestingModule({
      providers: [
        GoogleStrategy,
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    strategy = module.get<GoogleStrategy>(GoogleStrategy);
  });

  const makeProfile = (email: string) => ({
    emails: [{ value: email }],
    displayName: 'Alice',
    photos: [{ value: 'https://example.com/avatar.png' }],
  });

  it('calls upsertUser and returns user for @dsinnovators.com email', async () => {
    const profile = makeProfile('alice@dsinnovators.com');
    const mockUser = { id: 'uuid-1', email: 'alice@dsinnovators.com' };
    mockAuthService.upsertUser.mockResolvedValue(mockUser);

    const result = await strategy.validate(
      'accessToken',
      'refreshToken',
      profile,
    );

    expect(mockAuthService.upsertUser).toHaveBeenCalledWith({
      email: 'alice@dsinnovators.com',
      name: 'Alice',
      avatarUrl: 'https://example.com/avatar.png',
    });
    expect(result).toEqual(mockUser);
  });

  it('throws UnauthorizedException for non-@dsinnovators.com email', async () => {
    const profile = makeProfile('alice@gmail.com');

    await expect(
      strategy.validate('accessToken', 'refreshToken', profile),
    ).rejects.toThrow(UnauthorizedException);
    expect(mockAuthService.upsertUser).not.toHaveBeenCalled();
  });

  it.each([
    ['empty', ''],
    ['unset', undefined],
  ])(
    'allows any email domain when ALLOWED_EMAIL_DOMAINS is %s',
    async (_label, value) => {
      if (value === undefined) delete config.ALLOWED_EMAIL_DOMAINS;
      else config.ALLOWED_EMAIL_DOMAINS = value;
      const profile = makeProfile('alice@gmail.com');
      const mockUser = { id: 'uuid-2', email: 'alice@gmail.com' };
      mockAuthService.upsertUser.mockResolvedValue(mockUser);

      const result = await strategy.validate(
        'accessToken',
        'refreshToken',
        profile,
      );

      expect(mockAuthService.upsertUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'alice@gmail.com' }),
      );
      expect(result).toEqual(mockUser);
    },
  );
});
