# Frontend — DSI Club

React 19 + Vite 7 client for the DSI Club growth tracker.

> First-time setup for the whole monorepo is documented in the [root README](../../README.md#-getting-started). This file covers frontend-specific details.

## Quick start

```bash
pnpm --filter frontend dev
```

Runs on **http://localhost:5173**.

The app needs the backend running to do anything past the landing page — login redirects through the API's Google OAuth flow. Start both at once from the repo root with `pnpm dev`.

## Stack

- **React 19** with **Vite 7** (HMR, `@` → `./src` alias)
- **Tailwind CSS 4** via `@tailwindcss/vite`, with Radix-based UI primitives
- **React Router 7** for routing
- **TanStack Query** for server state, **Zustand** for client state
- **axios** for HTTP, **jwt-decode** for reading the access token, **sonner** for toasts

## Environment variables

There is no `.env.example`. The app reads a single optional variable, which defaults to the local backend:

| Variable       | Default                 | Description       |
| -------------- | ----------------------- | ----------------- |
| `VITE_API_URL` | `http://localhost:3000` | Backend base URL. |

To point at a different backend, create `apps/frontend/.env`:

```bash
VITE_API_URL=http://localhost:3001
```

Vite only exposes variables prefixed with `VITE_`, and the dev server must be restarted after changing them.

## Scripts

```bash
pnpm dev          # Vite dev server
pnpm build        # tsc -b && vite build
pnpm preview      # Serve the production build locally
pnpm lint         # ESLint with auto-fix
pnpm type-check   # tsc --noEmit
```

Prefix with `pnpm --filter frontend` when running from the repo root. No test runner is configured yet.

## Project layout

```
src/
├── app/          # App shell, providers, router setup
├── features/     # auth, clubs, topics, enrollments, sessions,
│                 # dashboard, users, search, landing
├── pages/        # Route components
├── components/   # Shared UI components
├── services/     # axios client, interceptors, API helpers
├── store/        # Zustand stores
└── lib/          # Utilities
```

Each folder under `features/` holds its own components, hooks, and API calls. Anything shared across features moves up into `components/`, `services/`, or `lib/`; anything shared with the backend belongs in `packages/shared`.

## Auth flow

Login redirects to the backend's `/auth/google`. After Google authenticates, the backend redirects back to `/auth/callback` with an access token and refresh token in the query string. `pages/auth/callback-page.tsx` writes both to `localStorage` via `services/token-storage.ts`.

From there, `store/auth.store.ts` decodes the access token for `userId`, `email`, and `isAuthority`, while coordinator and mentor status — which live in join tables and can't ride on the token — come from `/auth/me` through `features/auth/hooks/use-current-user.ts`.

The axios request interceptor in `services/http/client.ts` attaches the bearer token to every call. Note that it does **not** yet refresh expired tokens: the refresh token is stored but `/auth/refresh` is never called, so a session ends when the 15-minute access token expires.
