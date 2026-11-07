# DSI Club — Growth Tracker

A learning and growth tracking platform for DSI Clubs. Built as a pnpm monorepo with a NestJS API, a React frontend, and a shared TypeScript package.

## 📋 Table of Contents

- [Overview](#-overview)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Google OAuth Setup](#-google-oauth-setup)
- [Database Workflow](#-database-workflow)
- [Available Scripts](#-available-scripts)
- [Architecture](#-architecture)
- [Code Quality](#-code-quality)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

## 🎯 Overview

An **authority** sets up clubs and appoints coordinators. Coordinators create topics within their club and assign mentors. Members enroll in topics, work through course modules and their tasks, attend sessions, and earn certifications. Dashboards and activity sheets report progress back to coordinators, mentors, and the authority.

The repo contains three workspaces:

- **Backend** (`apps/backend`) — NestJS 11 API, PostgreSQL via Drizzle ORM, Google OAuth → JWT auth
- **Frontend** (`apps/frontend`) — React 19 + Vite 7 + Tailwind 4
- **Shared** (`packages/shared`) — types, enums, constants, and Zod schemas used by both

## 📁 Project Structure

```
growth-tracker/
├── apps/
│   ├── backend/          # NestJS API
│   │   ├── drizzle/      # Committed SQL migrations
│   │   ├── src/
│   │   │   ├── core/     # Database, guards, filters, decorators, pipes
│   │   │   └── modules/  # Feature modules (auth, clubs, topics, ...)
│   │   ├── docker-compose.yml  # Local PostgreSQL
│   │   └── .env.example
│   └── frontend/         # React + Vite app
│       └── src/
│           ├── features/ # Feature folders (auth, clubs, topics, ...)
│           ├── pages/    # Route components
│           └── services/ # API client
├── packages/
│   └── shared/           # Shared TypeScript package (tsup)
├── .husky/               # Git hooks (pre-commit)
├── eslint.config.mjs     # Root ESLint configuration
├── pnpm-workspace.yaml   # pnpm workspace configuration
└── package.json          # Root scripts
```

## 🔧 Prerequisites

- **Node.js** v20 or higher (required by NestJS 11 and Vite 7)
- **pnpm** v10.16.1 or higher — [Install pnpm](https://pnpm.io/installation)
- **Docker** — used to run PostgreSQL locally
- **Git**

```bash
node --version    # v20+
pnpm --version    # 10.16.1+
docker --version
```

## 🚀 Getting Started

### 1. Clone and install

```bash
git clone https://github.com/plabonislam/growth-tracker.git
cd growth-tracker
pnpm install
```

> Planning to contribute? Fork the repository and clone your fork instead — see [Contributing](#-contributing).

### 2. Build the shared package

Backend and frontend both import from `shared`, so it must be built first:

```bash
pnpm --filter shared build
```

### 3. Configure environment variables

```bash
cp apps/backend/.env.example apps/backend/.env
```

`DATABASE_URL` and `JWT_SECRET` are **required** — the backend throws at startup without them. Set `JWT_SECRET` to any long random string for local development. See [Environment Variables](#-environment-variables) for the full list, and [Google OAuth Setup](#-google-oauth-setup) for the Google keys.

### 4. Start PostgreSQL

```bash
pnpm --filter backend docker:up
```

This starts a `postgres:16-alpine` container on port `5432` with database `dsi_club`, matching the default `DATABASE_URL`. Data persists in a named Docker volume.

### 5. Apply migrations

```bash
pnpm --filter backend db:migrate
```

Required on a fresh database — without it, every query fails with `relation "users" does not exist`.

### 6. Seed sample data (optional)

```bash
pnpm --filter backend db:seed
```

Inserts sample users, clubs, and topics. Set `SEED_EMAIL` in `.env` to your own Google account first — the seeder promotes that account to authority, which is how you get admin access. The sample data includes its own authority accounts, but you can't log in as them, so skipping `SEED_EMAIL` leaves you with a member-level account.

### 7. Run the app

```bash
pnpm dev
```

| Service      | URL                            |
| ------------ | ------------------------------ |
| Frontend     | http://localhost:5173          |
| Backend API  | http://localhost:3000          |
| Swagger docs | http://localhost:3000/api/docs |

Or run them individually with `pnpm dev:backend`, `pnpm dev:frontend`, `pnpm dev:shared`.

## 🔑 Environment Variables

### Backend (`apps/backend/.env`)

| Variable                | Required      | Default                                      | Description                                                                                 |
| ----------------------- | ------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | **Yes**       | —                                            | PostgreSQL connection string. App fails to start without it.                                |
| `JWT_SECRET`            | **Yes**       | —                                            | Secret used to sign JWTs. App fails to start without it.                                    |
| `SEED_EMAIL`            | For `db:seed` | —                                            | Email promoted to authority when seeding.                                                   |
| `GOOGLE_CLIENT_ID`      | For login     | `''`                                         | Google OAuth client ID.                                                                     |
| `GOOGLE_CLIENT_SECRET`  | For login     | `''`                                         | Google OAuth client secret.                                                                 |
| `GOOGLE_CALLBACK_URL`   | No            | `http://localhost:3000/auth/google/callback` | Must match the redirect URI registered in Google Cloud Console.                             |
| `ALLOWED_EMAIL_DOMAINS` | No            | `''`                                         | Comma-separated domains allowed to sign in. **Empty means any Google account is accepted.** |
| `FRONTEND_URL`          | No            | `http://localhost:5173`                      | CORS origin and OAuth redirect target.                                                      |
| `PORT`                  | No            | `3000`                                       | Backend listening port.                                                                     |

> **Note:** `.env.example` currently ships only the first five keys. The remaining four are read by the code and can be added to your `.env` when you need to override a default.

### Frontend

The frontend has no `.env.example`. It reads a single optional variable, which defaults to the local backend:

| Variable       | Default                 | Description       |
| -------------- | ----------------------- | ----------------- |
| `VITE_API_URL` | `http://localhost:3000` | Backend base URL. |

## 🔐 Google OAuth Setup

Login uses Google OAuth. To get credentials for local development:

1. Go to [Google Cloud Console](https://console.cloud.google.com) and select or create a project.
2. **APIs & Services → OAuth consent screen** — choose **External**, fill in the app name and support email, and add your own Google account under **Test users**. While the app is in Testing status, only listed test users can sign in.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URI: `http://localhost:3000/auth/google/callback`
4. Copy the generated client ID and secret into `apps/backend/.env`:

   ```bash
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

The redirect URI must match `GOOGLE_CALLBACK_URL` exactly, or Google returns `redirect_uri_mismatch`.

To restrict sign-in to an organization's domain, set `ALLOWED_EMAIL_DOMAINS`:

```bash
ALLOWED_EMAIL_DOMAINS=dsinnovators.com
```

Any account outside the listed domains is then rejected with a 401. Leaving it unset allows **any** Google account.

## 🗄️ Database Workflow

PostgreSQL runs in Docker; schema changes are managed with [Drizzle Kit](https://orm.drizzle.team/docs/kit-overview). Migrations are committed under `apps/backend/drizzle/`.

```bash
# Start / stop the database container
pnpm --filter backend docker:up
pnpm --filter backend docker:down

# After editing src/core/database/schema/*.ts — generate a migration
pnpm --filter backend db:generate

# Apply pending migrations
pnpm --filter backend db:migrate

# Seed sample data (needs SEED_EMAIL)
pnpm --filter backend db:seed

# Browse data in Drizzle Studio
pnpm --filter backend db:studio
```

Commit generated migration files along with the schema change — `db:migrate` on another machine relies on them.

## 📜 Available Scripts

### Root

| Script              | Description                                          |
| ------------------- | ---------------------------------------------------- |
| `pnpm dev`          | Start shared (watch), frontend, and backend together |
| `pnpm dev:backend`  | Start the backend only                               |
| `pnpm dev:frontend` | Start the frontend only                              |
| `pnpm dev:shared`   | Build the shared package                             |
| `pnpm format`       | Format all files with Prettier                       |
| `pnpm format:check` | Check formatting without modifying files             |
| `pnpm lint`         | Run ESLint across all three workspaces               |
| `pnpm type-check`   | Run TypeScript type checking across all workspaces   |

There is no root `build` or `test` script — run those per workspace.

### Backend — `pnpm --filter backend <script>`

| Script                             | Description                              |
| ---------------------------------- | ---------------------------------------- |
| `start:dev`                        | Development server with watch mode       |
| `start:debug`                      | Development server with debugging        |
| `build` / `start:prod`             | Build, then run from `dist/`             |
| `docker:up` / `docker:down`        | Start / stop the PostgreSQL container    |
| `db:generate`                      | Generate a migration from schema changes |
| `db:migrate`                       | Apply pending migrations                 |
| `db:seed`                          | Seed sample data                         |
| `db:studio`                        | Open Drizzle Studio                      |
| `test` / `test:watch` / `test:cov` | Jest unit tests                          |
| `test:e2e`                         | End-to-end tests                         |
| `lint` / `type-check`              | ESLint with auto-fix / `tsc --noEmit`    |

### Frontend — `pnpm --filter frontend <script>`

| Script                | Description                           |
| --------------------- | ------------------------------------- |
| `dev`                 | Start the Vite dev server             |
| `build`               | Type-check and build for production   |
| `preview`             | Preview the production build          |
| `lint` / `type-check` | ESLint with auto-fix / `tsc --noEmit` |

No test runner is configured for the frontend yet.

### Shared — `pnpm --filter shared <script>`

| Script                | Description                             |
| --------------------- | --------------------------------------- |
| `build`               | Build the package with tsup (ESM + CJS) |
| `test`                | Vitest unit tests                       |
| `lint` / `type-check` | ESLint with auto-fix / `tsc --noEmit`   |

## 🏗️ Architecture

### Backend

- **Framework**: NestJS 11 · **ORM**: Drizzle · **Database**: PostgreSQL 16 · **Validation**: Zod · **Docs**: Swagger at `/api/docs`
- **No global route prefix** — endpoints are served at the root (`/auth/...`, `/clubs`, `/dashboard`, ...).
- `src/core/` — database connection and schema, global guards (`JwtAuthGuard`, `PermissionsGuard`), exception filter, decorators, pipes.
- `src/modules/` — feature modules, each following a controller / service / repository split: `auth`, `user`, `clubs`, `topics`, `course-modules`, `enrollments`, `progress`, `sessions`, `dashboard`.

**Auth flow**: `GET /auth/google` redirects to Google → `GET /auth/google/callback` upserts the user and redirects to the frontend with an access token (15m) and refresh token (5h) → `POST /auth/refresh` exchanges a refresh token for a new access token. `JwtAuthGuard` is applied globally; routes opt out with the `@Public()` decorator.

**Schema** (`src/core/database/schema/`): `users` (with an `is_authority` flag), `clubs` and `club_memberships`, `topics` with `topic_mentors` and `topic_enrollments`, `course_modules` and `module_resources`, `tasks` and `task_submissions`, `module_progress` and `certifications`, `sessions`, `notifications`.

### Frontend

- **Framework**: React 19 · **Build**: Vite 7 · **Styling**: Tailwind 4 · **Routing**: React Router 7 · **Server state**: TanStack Query · **Client state**: Zustand · **HTTP**: axios
- `src/features/` — feature folders (`auth`, `clubs`, `topics`, `enrollments`, `sessions`, `dashboard`, `users`, `search`, `landing`), each with its own components, hooks, and API layer.
- `src/pages/` — route components · `src/components/` — shared UI · `src/services/` — axios client and interceptors.

### Shared

Built with tsup to both ESM and CJS with type declarations. Exports types, enums, constants, and Zod schemas:

```typescript
import { something } from 'shared';
```

## ✨ Code Quality

### Pre-commit hooks

`.husky/pre-commit` runs on every commit:

1. **`pnpm type-check`** — TypeScript validation across all workspaces
2. **`pnpm lint-staged`** — Prettier and ESLint (`--max-warnings=0`) on staged files

A failing check blocks the commit.

### Manual checks

```bash
pnpm format        # Format all files
pnpm format:check  # Check formatting (CI-friendly)
pnpm lint          # Lint all workspaces
pnpm type-check    # Type check all workspaces
```

### Tooling

- **Prettier** (`.prettierrc`), **ESLint** (root `eslint.config.mjs` plus per-workspace configs), **TypeScript**, **Husky**, **lint-staged**

## 🐛 Troubleshooting

### `Configuration key "JWT_SECRET" does not exist`

The backend can't find `apps/backend/.env`, or the file is missing the key. Copy `.env.example` and set `JWT_SECRET` and `DATABASE_URL`, then restart.

### `Failed query: select ... from "users"` / 500 on login

Either PostgreSQL isn't running or migrations haven't been applied:

```bash
docker ps                            # Is the postgres container up?
pnpm --filter backend docker:up      # Start it
pnpm --filter backend db:migrate     # Apply migrations
```

A fresh Docker volume starts empty, so `db:migrate` is always needed on first run.

### Google returns `redirect_uri_mismatch`

The redirect URI in Google Cloud Console must exactly match `GOOGLE_CALLBACK_URL` (default `http://localhost:3000/auth/google/callback`) — including scheme, port, and path.

### 401 `Email domain not allowed`

Your Google account's domain isn't listed in `ALLOWED_EMAIL_DOMAINS`. Add it, or unset the variable to allow any account.

### 403 from Google before reaching the app

The OAuth consent screen is in Testing status and your account isn't a registered test user. Add it under **OAuth consent screen → Test users**.

### Port already in use

```bash
# Backend
PORT=3001 pnpm --filter backend start:dev

# Frontend — Vite automatically picks the next free port
```

If you change the backend port, update `GOOGLE_CALLBACK_URL` (and the Google Cloud redirect URI) and the frontend's `VITE_API_URL` to match.

### Type or build errors after pulling

The shared package may be stale:

```bash
pnpm install
pnpm --filter shared build
```

### Dependencies not installing

```bash
rm -rf node_modules **/node_modules pnpm-lock.yaml
pnpm install
```

## 🤝 Contributing

Contributions go through a **fork and pull request** workflow. You don't need write access to the main repository — you work in your own fork and open a PR against upstream.

By submitting a pull request you agree that your contribution is licensed to DSi Club under the terms in [LICENSE](LICENSE) — see [License](#-license). No separate contributor agreement is needed.

### One-time setup

1. **Fork the repository** — click **Fork** on [plabonislam/growth-tracker](https://github.com/plabonislam/growth-tracker) to create a copy under your own account.

2. **Clone your fork** (not the upstream repo):

   ```bash
   git clone https://github.com/<your-username>/growth-tracker.git
   cd growth-tracker
   ```

3. **Add upstream as a remote** so you can pull in other people's merged work:

   ```bash
   git remote add upstream https://github.com/plabonislam/growth-tracker.git
   git remote -v   # origin = your fork, upstream = the main repo
   ```

4. Follow [Getting Started](#-getting-started) to install dependencies and set up the database.

### Making a change

1. **Sync with upstream** before starting anything new, so your branch isn't based on stale code:

   ```bash
   git checkout master
   git pull upstream master
   git push origin master
   ```

2. **Branch off `master`.** Name it for what it does, using the same prefixes as the commit convention below:

   ```bash
   git checkout -b feat/topic-enrollment
   # or: fix/..., docs/..., refactor/..., chore/...
   ```

3. **Make your changes**, following existing patterns. If you touch the database schema, generate and commit a migration (see [Database Workflow](#-database-workflow)).

4. **Verify**

   ```bash
   pnpm type-check
   pnpm lint
   pnpm --filter backend test
   ```

5. **Commit** — the pre-commit hook type-checks, lints, and formats automatically.

   ```bash
   git commit -m "feat: your feature description"
   ```

6. **Push to your fork**

   ```bash
   git push -u origin feat/topic-enrollment
   ```

7. **Open a pull request** from your branch to **`plabonislam/growth-tracker` → `master`**. GitHub offers this automatically after a push, or use the [GitHub CLI](https://cli.github.com/):

   ```bash
   gh pr create --repo plabonislam/growth-tracker --base master
   ```

   In the description, explain what changed and why, link the issue it closes (`Closes #36`), and mention anything a reviewer needs in order to test it — a new environment variable, a migration to run, or a manual step.

### Keeping a long-running PR up to date

If `master` moves while your PR is open, rebase rather than merging, so history stays linear:

```bash
git fetch upstream
git rebase upstream/master
git push --force-with-lease origin feat/topic-enrollment
```

Use `--force-with-lease`, never a plain `--force` — it refuses to overwrite commits you haven't seen, which protects work pushed to the branch by someone else.

### Review

PRs need a review before merge. Push follow-up commits to the same branch to address feedback; the PR updates automatically. Keep a PR focused on one thing — a small, single-purpose PR gets reviewed far faster than a large mixed one.

### Commit messages

Follow [conventional commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:`.

```bash
git commit -m "feat(backend): add topic enrollment endpoint"
```

### Code style

- TypeScript for all new code, no `any` without good reason
- Keep feature code inside its module (backend) or feature folder (frontend)
- Put anything both apps need into `packages/shared`
- Never commit `.env` — it's gitignored, and secrets belong in your local file only

## 📄 License

Copyright © 2024–2026 DSi Club. This project is **proprietary and source-available**, not open source. You may view the source and fork or run it locally to review it or contribute back via pull request; all other rights — including commercial or production use, redistribution, and derivative works — are reserved. See [LICENSE](LICENSE) for the full terms.

## 📚 Resources

- [pnpm Workspaces](https://pnpm.io/workspaces)
- [NestJS](https://docs.nestjs.com/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [TanStack Query](https://tanstack.com/query/latest)
