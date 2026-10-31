import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';

const mockAuthService = {
  getMe: jest.fn(),
  refreshAccessToken: jest.fn(),
  revokeTokens: jest.fn(),
};

const mockUser = {
  id: 'uuid-1',
  name: 'Alice',
  email: 'alice@dsinnovators.com',
  avatarUrl: null,
  isAuthority: false,
  createdAt: new Date(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('GET /auth/me', () => {
    it('returns user profile for authenticated user', async () => {
      mockAuthService.getMe.mockResolvedValue(mockUser);
      const currentUser = {
        userId: 'uuid-1',
        email: 'alice@dsinnovators.com',
        isAuthority: false,
      };

      const result = await controller.getMe(currentUser);

      expect(mockAuthService.getMe).toHaveBeenCalledWith('uuid-1');
      expect(result).toEqual(mockUser);
    });
  });

  describe('POST /auth/refresh', () => {
    it('returns new accessToken for valid refresh token', async () => {
      mockAuthService.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-access-token',
      });

      const result = await controller.refresh({ refreshToken: 'valid-token' });

      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith(
        'valid-token',
      );
      expect(result).toEqual({ accessToken: 'new-access-token' });
    });

    it('returns 401 when refreshAccessToken throws UnauthorizedException', async () => {
      mockAuthService.refreshAccessToken.mockRejectedValue(
        new UnauthorizedException(),
      );

      await expect(
        controller.refresh({ refreshToken: 'bad-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('POST /auth/logout', () => {
    it("revokes the caller's tokens", async () => {
      mockAuthService.revokeTokens.mockResolvedValue(undefined);
      const currentUser = {
        userId: 'uuid-1',
        email: 'alice@dsinnovators.com',
        isAuthority: false,
      };

      const result = await controller.logout(currentUser);

      expect(mockAuthService.revokeTokens).toHaveBeenCalledWith('uuid-1');
      expect(result).toEqual({ message: 'Logged out' });
    });
  });
});
