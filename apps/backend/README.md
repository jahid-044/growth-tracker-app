# Backend — DSI Club API

NestJS 11 API for the DSI Club growth tracker. PostgreSQL via Drizzle ORM, Google OAuth → JWT authentication.

> First-time setup (Docker, migrations, Google credentials) is documented in the [root README](../../README.md#-getting-started). This file covers backend-specific details.

## Quick start

From the repo root, with `apps/backend/.env` configured:

```bash
pnpm --filter backend docker:up      # Start PostgreSQL
pnpm --filter backend db:migrate     # Apply migrations
pnpm --filter backend start:dev      # Run with watch mode
```

The API listens on `PORT` (default `3000`). Swagger UI is at **http://localhost:3000/api/docs**.

There is **no global route prefix** — endpoints are served at the root: `/auth/google`, `/clubs`, `/topics`, `/dashboard`, and so on.

## Environment variables

Copy `.env.example` to `.env` and fill it in.

| Variable                | Required      | Default                                      | Description                                                                      |
| ----------------------- | ------------- | -------------------------------------------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL`          | **Yes**       | —                                            | PostgreSQL connection string. Startup throws without it.                         |
| `JWT_SECRET`            | **Yes**       | —                                            | JWT signing secret. Startup throws without it.                                   |
| `SEED_EMAIL`            | For `db:seed` | —                                            | Email promoted to authority when seeding.                                        |
| `GOOGLE_CLIENT_ID`      | For login     | `''`                                         | Google OAuth client ID.                                                          |
| `GOOGLE_CLIENT_SECRET`  | For login     | `''`                                         | Google OAuth client secret.                                                      |
| `GOOGLE_CALLBACK_URL`   | No            | `http://localhost:3000/auth/google/callback` | Must match the redirect URI registered in Google Cloud Console.                  |
| `ALLOWED_EMAIL_DOMAINS` | No            | `''`                                         | Comma-separated allowed domains. **Empty means any Google account is accepted.** |
| `FRONTEND_URL`          | No            | `http://localhost:5173`                      | CORS origin and post-login redirect target.                                      |
| `PORT`                  | No            | `3000`                                       | Listening port.                                                                  |

`.env.example` ships only the first five keys; the rest have working defaults and can be added when you need to override them.

## Scripts

```bash
# Development
pnpm start:dev        # Watch mode
pnpm start:debug      # Watch mode with debugger
pnpm build            # Compile to dist/
pnpm start:prod       # Run the compiled build

# Database
pnpm docker:up        # Start PostgreSQL (postgres:16-alpine on :5432)
pnpm docker:down      # Stop it
pnpm db:generate      # Generate a migration after editing the schema
pnpm db:migrate       # Apply pending migrations
pnpm db:seed          # Seed sample users, clubs, and topics
pnpm db:studio        # Browse data in Drizzle Studio

# Quality
pnpm test             # Jest unit tests
pnpm test:watch
pnpm test:cov
pnpm test:e2e         # End-to-end tests (test/jest-e2e.json)
pnpm lint             # ESLint with auto-fix
pnpm type-check       # tsc --noEmit
```

Prefix with `pnpm --filter backend` when running from the repo root.

## Project layout

```
src/
├── main.ts              # Bootstrap: helmet, CORS, Swagger, shutdown hooks
├── app.module.ts
├── core/
│   ├── database/        # Drizzle connection, schema/, seed.ts, seed-data/
│   ├── guards/          # JwtAuthGuard + PermissionsGuard (both global)
│   ├── filters/         # HttpExceptionFilter (global)
│   ├── decorators/      # @Public(), @CurrentUser(), permission decorators
│   └── pipes/           # Zod validation
└── modules/             # auth, user, clubs, topics, course-modules,
                         # enrollments, progress, sessions, dashboard
```

Each feature module follows a controller / service / repository split, with unit tests in a sibling `__tests__/` folder.

## Authentication

`JwtAuthGuard` is registered globally, so **every route requires a bearer token by default**. Opt out with the `@Public()` decorator. `PermissionsGuard` handles role checks on top of that.

| Route                       | Description                                                         |
| --------------------------- | ------------------------------------------------------------------- |
| `GET /auth/google`          | Redirects to Google's consent screen                                |
| `GET /auth/google/callback` | Upserts the user, then redirects to `FRONTEND_URL` with both tokens |
| `GET /auth/me`              | Current user profile and roles (authority / coordinator / mentor)   |
| `POST /auth/refresh`        | Exchanges a refresh token for a new access token                    |
| `POST /auth/logout`         | Client-side token clear                                             |

Access tokens expire after 15 minutes, refresh tokens after 5 hours. Roles are derived from data rather than stored on the token: `is_authority` is a flag on `users`, while coordinator and mentor status come from `clubs.coordinator_id` and `topic_mentors`.

## Database

Schema lives in `src/core/database/schema/` and is the source of truth — edit it, then run `db:generate` to produce a migration in `drizzle/`. Both the schema change and the generated SQL should be committed together.

Tables: `users`, `clubs`, `club_memberships`, `topics`, `topic_mentors`, `topic_enrollments`, `course_modules`, `module_resources`, `tasks`, `task_submissions`, `module_progress`, `certifications`, `sessions`, `notifications`.
