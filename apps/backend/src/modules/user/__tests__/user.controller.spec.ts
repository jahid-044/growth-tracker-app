import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsGuard } from '../../../core/guards/permissions.guard';
import { UserController } from '../user.controller';
import { UserService } from '../user.service';

const mockUserService = {
  findAll: jest.fn(),
};

const mockUsers = [
  {
    id: 'uuid-1',
    name: 'Alice',
    email: 'alice@dsinnovators.com',
    avatarUrl: null,
  },
  { id: 'uuid-2', name: 'Bob', email: 'bob@dsinnovators.com', avatarUrl: null },
];

// Shaped like JwtStrategy.validate()'s return value, and routed to the real
// findAll handler so the guard reads the metadata @RequireRole() actually set.
const makeGuardContext = (isAuthority: boolean) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        user: {
          userId: 'uuid-1',
          email: 'alice@dsinnovators.com',
          isAuthority,
        },
      }),
    }),
    // Taken as a metadata key, never called, so the unbound `this` the rule
    // guards against cannot arise.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    getHandler: () => UserController.prototype.findAll,
    getClass: () => UserController,
  }) as unknown as ExecutionContext;

describe('UserController', () => {
  let controller: UserController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: mockUserService }],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  describe('GET /users', () => {
    const guard = new PermissionsGuard(new Reflector());

    it('returns user list for Authority user', async () => {
      mockUserService.findAll.mockResolvedValue(mockUsers);

      const result = await controller.findAll();

      expect(mockUserService.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockUsers);
    });

    it('lets an Authority user through PermissionsGuard', () => {
      expect(guard.canActivate(makeGuardContext(true))).toBe(true);
    });

    it('returns 403 for non-Authority user via PermissionsGuard', () => {
      expect(() => guard.canActivate(makeGuardContext(false))).toThrow(
        ForbiddenException,
      );
    });
  });
});
