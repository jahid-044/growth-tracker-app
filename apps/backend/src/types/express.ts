// Passport sets req.user after JWT token validation, but Express's built-in
// Request type has no `user` property. Without this type, every access to
// req.user is implicitly `any`, bypassing type safety in guards, decorators,
// and any other middleware that inspects the authenticated principal.
// express-serve-static-core is not directly resolvable under pnpm's strict
// isolation, so we export the shape here and apply it via intersection types
// at each call site (see current-user.decorator.ts, permissions.guard.ts).

export declare interface AuthenticatedUser {
  id: string;
  isAuthority: boolean;
}
