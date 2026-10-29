# Crashed NIS

A clean-room client for **NIS (Назарбаев Интеллектуальные школы)** student services: a
Bun-workspace monorepo containing a Hono API that proxies and re-authenticates NIS
microservice calls, and a Vite + React web app for the student dashboard (journal,
transcript, mark forecasting).

> **Disclaimer.** This project is an independent client and is not affiliated with or endorsed
> by НИШ / NIS School.

## Architecture

```
crashed.nis/
├── apps/
│   ├── api/                 # Hono on Cloudflare Workers — auth + NIS proxy API
│   │   ├── bruno/           # Version-controlled Bruno request collection
│   │   ├── src/
│   │   │   ├── features/    # auth, student-data, user-info services
│   │   │   ├── lib/         # token compression, JWT, issuer, city parsing
│   │   │   ├── routes/      # auth + data routers
│   │   │   └── shared/      # config, errors, http client (ky), schemas
│   │   └── tests/           # Vitest in-memory integration tests
│   └── web/                 # Vite + React dashboard
│       ├── components/      # app-specific UI (modals, marks tables, layout)
│       ├── src/pages/       # Журнал / Табель / Настройки / Прогноз / auth
│       ├── lib/             # api client + SWR hook, stores (zustand), helpers
│       └── *.test.ts(x)     # Vitest + happy-dom tests co-located with sources
├── packages/
│   ├── types/               # @crashed-nis/types — cross-workspace contracts
│   ├── tsconfig/            # shared strict TypeScript configs
│   └── ui/                  # @crashednis/ui — shared shadcn-style components
└── turbo.json               # Turborepo task graph
```

Data path: `web → /api/* (Vite proxy locally, Pages Function in production) → Hono Worker → NIS upstream`.
The Worker holds HttpOnly, Secure cookies for the NIS access/refresh tokens and never exposes
them to the browser; every upstream call goes through a single configured `ky` client.

## Tech stack

| Layer     | Tooling                                                                                    |
| --------- | ------------------------------------------------------------------------------------------ |
| Workspace | Bun workspaces + Turborepo                                                                 |
| API       | Hono (`@hono/zod-openapi`), Cloudflare Workers, `ky`, Zod, Wrangler                        |
| Web       | Vite, React 19, React Router (generouted), Tailwind CSS v4, SWR, Zustand, Base UI (shadcn) |
| Quality   | TypeScript, oxlint, oxfmt, husky + lint-staged, release-please                             |

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.4 (the only runtime/package manager — scripts and `bun.lock` assume it)
- A Cloudflare account for deploying the Worker/Pages (development needs nothing extra)
- Node.js is **not** required except APIs in `@types/node` for typechecking

## Getting started

```bash
bun install            # installs all workspaces
bun run dev            # API on http://localhost:8787 + web on http://localhost:5173
```

Local device testing over HTTPS (required for iOS Safari because cookies are `Secure`):

```bash
bun run --cwd apps/web dev:https
```

### Environment

- `apps/web`: copy `.env.example` to `.env.local` to point Vite at a non-default API
  (`BACKEND_URL`, default `http://localhost:8787`).
- `apps/api`: production secrets/vars are configured with `wrangler secret put` — never commit
  them; see `DEPLOYMENT.md`.

## Scripts

Run from the repo root (Turborepo orders workspaces):

| Script              | What it does                                               |
| ------------------- | ---------------------------------------------------------- |
| `bun run dev`       | Dev servers for all workspaces                             |
| `bun run build`     | Production builds (Vite web, Wrangler dry-run api, types)  |
| `bun run test`      | Vitest suites (API in-memory `app.fetch`, web `happy-dom`) |
| `bun run lint`      | oxlint across workspaces                                   |
| `bun run format`    | oxfmt across workspaces                                    |
| `bun run typecheck` | `tsc --noEmit` for every workspace                         |

Per-workspace extras: `bun run --cwd apps/api typegen` (regenerate Worker binding types after
Wrangler config changes), `bun run --cwd apps/web typegen` (Pages bindings).

## API documentation

- OpenAPI 3.1 spec: `/openapi.json` on the Worker, `/api/openapi.json` through the web proxy
- Scalar reference: `/docs` in the web app

## Releases

Releases are automated by `release-please` from Conventional Commits; deployment steps and
commit format are documented in [`DEPLOYMENT.md`](DEPLOYMENT.md). Git hooks (husky) format and
typecheck staged changes on every `git commit`.
