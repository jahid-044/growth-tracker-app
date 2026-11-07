import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../../../core/database/database.service';
import { AuthService } from '../auth.service';

const TEST_SECRET = 'test-secret';

const mockUser = {
  id: 'uuid-1',
  name: 'Alice',
  email: 'alice@dsinnovators.com',
  avatarUrl: 'https://example.com/avatar.png',
  isAuthority: false,
  tokenVersion: 0,
  createdAt: new Date(),
};

const mockGoogleProfile = {
  email: 'alice@dsinnovators.com',
  name: 'Alice',
  avatarUrl: 'https://example.com/avatar.png',
};

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;
  let mockDb: { select: jest.Mock; insert: jest.Mock; update: jest.Mock };

  beforeEach(async () => {
    mockDb = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: TEST_SECRET,
          signOptions: { expiresIn: '15m' },
        }),
      ],
      providers: [
        AuthService,
        { provide: DatabaseService, useValue: { db: mockDb } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('upsertUser', () => {
    it('creates new user on first Google login', async () => {
      const selectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };
      mockDb.select.mockReturnValue(selectChain);
      const insertChain = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockUser]),
      };
      mockDb.insert.mockReturnValue(insertChain);

      const result = await service.upsertUser(mockGoogleProfile);

      expect(mockDb.insert).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('updates and returns existing user on repeat login', async () => {
      const selectChain = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockUser]),
      };
      mockDb.select.mockReturnValue(selectChain);
      const updatedUser = { ...mockUser, name: 'Alice Updated' };
      const updateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([updatedUser]),
      };
      mockDb.update.mockReturnValue(updateChain);

      const result = await service.upsertUser({
        ...mockGoogleProfile,
        name: 'Alice Updated',
      });

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(result).toEqual(updatedUser);
    });
  });

  describe('generateTokens', () => {
    it('returns accessToken and refreshToken', () => {
      const { accessToken, refreshToken } = service.generateTokens(mockUser);

      expect(typeof accessToken).toBe('string');
      expect(accessToken.length).toBeGreaterThan(0);
      expect(typeof refreshToken).toBe('string');
      expect(refreshToken.length).toBeGreaterThan(0);
    });

    it('accessToken payload carries userId, email, isAuthority', () => {
      const userWithAuthority = { ...mockUser, isAuthority: true };
      const { accessToken } = service.generateTokens(userWithAuthority);

      const decoded = jwtService.decode<Record<string, unknown>>(accessToken);

      expect(decoded['sub']).toBe(mockUser.id);
      expect(decoded['email']).toBe(mockUser.email);
      expect(decoded['isAuthority']).toBe(true);
    });

    it('marks each token with its type and the user token version', () => {
      const { accessToken, refreshToken } = service.generateTokens({
        ...mockUser,
        tokenVersion: 3,
      });

      const access = jwtService.decode<Record<string, unknown>>(accessToken);
      const refresh = jwtService.decode<Record<string, unknown>>(refreshToken);

      expect(access).toMatchObject({ typ: 'access', ver: 3 });
      expect(refresh).toMatchObject({ typ: 'refresh', ver: 3 });
    });
  });

  /** The user row `resolveTokenUser` reads back for the token's `sub`. */
  const givenUserRow = (rows: unknown[]) => {
    mockDb.select.mockReturnValue({
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue(rows),
    });
  };

  describe('refreshAccessToken', () => {
    it('returns new accessToken for valid refresh token', async () => {
      givenUserRow([mockUser]);
      const { refreshToken } = service.generateTokens(mockUser);

      const result = await service.refreshAccessToken(refreshToken);

      expect(Object.keys(result)).toEqual(['accessToken']);
      expect(
        jwtService.decode<Record<string, unknown>>(result.accessToken),
      ).toMatchObject({ sub: mockUser.id, typ: 'access', ver: 0 });
    });

    it('rejects an access token, so a session cannot renew itself', async () => {
      givenUserRow([mockUser]);
      const { accessToken } = service.generateTokens(mockUser);

      await expect(service.refreshAccessToken(accessToken)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it('takes isAuthority from the database, not the old token', async () => {
      const { refreshToken } = service.generateTokens({
        ...mockUser,
        isAuthority: true,
      });
      givenUserRow([{ ...mockUser, isAuthority: false }]);

      const { accessToken } = await service.refreshAccessToken(refreshToken);

      expect(
        jwtService.decode<Record<string, unknown>>(accessToken)['isAuthority'],
      ).toBe(false);
    });

    it('rejects a refresh token whose user no longer exists', async () => {
      const { refreshToken } = service.generateTokens(mockUser);
      givenUserRow([]);

      await expect(service.refreshAccessToken(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a refresh token revoked by a later logout', async () => {
      const { refreshToken } = service.generateTokens(mockUser);
      givenUserRow([{ ...mockUser, tokenVersion: 1 }]);

      await expect(service.refreshAccessToken(refreshToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException for expired or tampered token', async () => {
      await expect(
        service.refreshAccessToken('tampered.token.here'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('resolveTokenUser', () => {
    const payload = {
      sub: mockUser.id,
      email: mockUser.email,
      isAuthority: false,
      typ: 'access' as const,
      ver: 0,
    };

    it('returns the current user row for a live token', async () => {
      givenUserRow([mockUser]);

      await expect(
        service.resolveTokenUser(payload, 'access'),
      ).resolves.toEqual(mockUser);
    });

    it('returns null for a token of the other type', async () => {
      await expect(
        service.resolveTokenUser(payload, 'refresh'),
      ).resolves.toBeNull();
    });

    it('returns null for a token issued before tokens were typed', async () => {
      const legacy = {
        sub: payload.sub,
        email: payload.email,
        isAuthority: payload.isAuthority,
      } as unknown as typeof payload;

      await expect(
        service.resolveTokenUser(legacy, 'access'),
      ).resolves.toBeNull();
    });

    it('returns null when the token version is stale', async () => {
      givenUserRow([{ ...mockUser, tokenVersion: 2 }]);

      await expect(
        service.resolveTokenUser(payload, 'access'),
      ).resolves.toBeNull();
    });
  });

  describe('revokeTokens', () => {
    it("bumps the user's token version", async () => {
      const updateChain = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(undefined),
      };
      mockDb.update.mockReturnValue(updateChain);

      await service.revokeTokens('uuid-1');

      expect(mockDb.update).toHaveBeenCalled();
      const [changes] = updateChain.set.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(Object.keys(changes)).toEqual(['tokenVersion']);
      expect(updateChain.where).toHaveBeenCalled();
    });
  });

  describe('getMe', () => {
    /**
     * `getMe` runs three selects at once: the profile, then one row each to
     * ask whether this user coordinates a club or mentors a topic. They are
     * answered in call order.
     */
    const givenSelects = (
      profileRows: unknown[],
      coordinatorRows: unknown[],
      mentorRows: unknown[],
    ) => {
      // The profile query ends at `where`; each role probe adds `limit`.
      const probe = (rows: unknown[]) => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue(rows),
        }),
      });

      mockDb.select
        .mockReturnValueOnce({
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockResolvedValue(profileRows),
        })
        .mockReturnValueOnce(probe(coordinatorRows))
        .mockReturnValueOnce(probe(mentorRows));
    };

    it('returns the profile with no roles for a plain learner', async () => {
      givenSelects([mockUser], [], []);

      const result = await service.getMe('uuid-1');

      expect(result).toEqual({
        ...mockUser,
        roles: { isAuthority: false, isCoordinator: false, isMentor: false },
      });
    });

    it('reports coordinating and mentoring from the join tables', async () => {
      givenSelects([mockUser], [{ id: 'club-1' }], [{ topicId: 'topic-1' }]);

      const result = await service.getMe('uuid-1');

      expect(result.roles).toEqual({
        isAuthority: false,
        isCoordinator: true,
        isMentor: true,
      });
    });

    it('throws NotFoundException when user not found', async () => {
      givenSelects([], [], []);

      await expect(service.getMe('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
