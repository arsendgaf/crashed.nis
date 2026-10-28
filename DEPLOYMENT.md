# Deployment & Release Guide

This guide covers how releases are cut (Conventional Commits + `release-please`), how the CI
pipeline validates changes, and how the two deployable units ship. **PR validation never
deploys live** — production deployments run only from `v*` release tags or manual
`workflow_dispatch` (`deploy-api.yml` / `deploy-web.yml`).

## CI/CD pipeline overview

| Workflow             | Trigger                | Jobs                                                                            |
| -------------------- | ---------------------- | ------------------------------------------------------------------------------- |
| `ci.yml`             | PRs + pushes to `main` | lint → typecheck → test → build (no deploy)                                     |
| `release-please.yml` | pushes to `main`       | opens/updates Release PRs, publishes GitHub Releases                            |
| `deploy-api.yml`     | tags `v*` or manual    | typecheck + API tests → `wrangler deploy` → health smoke check                  |
| `deploy-web.yml`     | tags `v*` or manual    | typecheck + build → `wrangler pages deploy dist --project-name=crashed-nis-web` |

## Secrets required for CD

Add both secrets at **GitHub → Settings → Secrets and variables → Actions → Repository secrets**
(never to `main` as plaintext):

| Secret                  | Where it gets the value (Cloudflare dashboard)                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CLOUDFLARE_API_TOKEN`  | My Profile → API Tokens. Create a token with **Workers Scripts:Edit**, **Cloudflare Pages:Edit** (and Account Resources scoped to the `crashed.nis` account) |
| `CLOUDFLARE_ACCOUNT_ID` | Workers & Pages → Overview → Account ID (copy the 32-char hex id)                                                                                            |

Optional non-secret variables (same page → "Variables" tab): `API_HEALTH_URL` — the API's
`https://crashed-nis-api.<subdomain>.workers.dev` base URL, consumed by the deploy-api smoke
check (the check is skipped when unset).

Recommended hardening: wrap each deploy job with a GitHub **Environment** (e.g. `production`,
Settings → Environments) and mark it as protected so the `CLOUDFLARE_*` secrets and the deploy
runs require a manual approval — see §3/§4 below. Deploy workflows currently reference
`${{ secrets.* }}` at the repository scope, so the secrets work with or without an environment.

## 1. Commit format (required)

All commits to `main` must follow [Conventional Commits](https://www.conventionalcommits.org/).
`release-please` derives versions and changelogs from them:

```
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

| Commit                                                                   | Effect on release                            |
| ------------------------------------------------------------------------ | -------------------------------------------- |
| `fix(api): handle malformed refresh cookie`                              | API patch bump                               |
| `feat(web): add mark forecast page`                                      | Web minor bump                               |
| `feat(api)!: drop bearer-cookie support` or `feat: … BREAKING CHANGE: …` | **major** bump                               |
| `chore(root): update tooling`                                            | No release (default)                         |
| `docs:, test:, refactor:, ci:, style:`                                   | Included in changelog, no version bump alone |

Scope must name the workspace: `api`, `web`, `types`, `ui`, `tsconfig` (or omit for root).
The `node-workspace` plugin keeps inter-package versions in sync.

## 2. Release flow (release-please)

1. Every push to `main` runs `.github/workflows/release-please.yml`:
   - With unreleased `feat`/`fix` commits it opens or updates a **Release PR** on GitHub
     (root `package.json` + workspace manifests, `CHANGELOG.md` files, tags placeholder).
   - When released versions exist it publishes GitHub Releases with the changelog sections.
2. Maintainer review of the Release PR:
   - Check the proposed version bumps (respect SemVer; breaking changes must come from `!`/`BREAKING CHANGE`).
   - Check `CHANGELOG.md` wording — it is user-facing.
3. Merge the Release PR. That merge sets the versions (currently `2.0.0`) and creates git tags;
   the next workflow run publishes the GitHub Release.
4. Manual rollback only: revert the Release PR merge commit; do not hand-edit the manifest —
   `.release-please-manifest.json` is initialized with `2.0.0` for all packages and after that
   is maintained exclusively by the bot.

Config lives in `release-please-config.json` (package map) and `.release-please-manifest.json`
(current versions).

## 3. Deploying the API (`apps/api` — Hono on Cloudflare Workers)

CI (`.github/workflows/ci.yml`) already proves: lint → typecheck → bun:test → Wrangler dry-run
build. After a release is merged/tagged:

1. Ensure bindings/secrets are configured (once per environment):
   - `wrangler secret put <NAME>` for secrets used by `apps/api/src/env.ts` (e.g. JWT secrets,
     upstream authorization values).
   - Rate Limiting, service bindings and vars live in `apps/api/wrangler.jsonc` — keep them in
     sync with the generated types (`bun run --cwd apps/api typegen`).
2. Deploy a tagged commit:
   ```bash
   git checkout v2.0.0          # or the tag you want
   bun run --cwd apps/api deploy
   ```
   Or rely on `.github/workflows/deploy-api.yml`, which runs automatically on `v*` tags (and
   manually via Actions → Deploy API → Run workflow) using the `CLOUDFLARE_API_TOKEN` /
   `CLOUDFLARE_ACCOUNT_ID` repository secrets.
3. Verify: `/health` and `/api/health` respond; `/api/openapi.json` serves the spec; login flow
   works against production NIS endpoints.

## 4. Deploying the Web (`apps/web` — Cloudflare Pages)

1. Create the Pages project named `crashed-nis-web`.
2. Bind the Pages Function to the Worker: `apps/web/wrangler.jsonc` holds the `API` service
   binding to the deployed `crashed-nis-api` Worker — configure it for both production and
   preview environments.
3. Build output: `apps/web/dist` (Vite). The `_redirects` file + `functions/api/[[path]].ts`
   proxy `/api/*` to the Worker; do **not** replace the Pages Function with external `_redirects`
   rewrites (Pages `_redirects` only supports relative proxies).
4. Deploy:
   ```bash
   bun run --cwd apps/web build
   bun x wrangler pages deploy dist --project-name crashed-nis-web
   ```
   Or use `.github/workflows/deploy-web.yml` (runs on `v*` tags / manual dispatch) — it
   typechecks, builds and pushes `dist` to Pages with the same two secrets.
5. Ensure the Service Binding is enabled in the Pages dashboard before cutting the API over.

> The `BACKEND_URL` used by the Vite dev proxy is dev-only — production web traffic goes through
> the Pages Function, never a client-configured API URL.
