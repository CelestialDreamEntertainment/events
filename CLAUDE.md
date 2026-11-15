# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The suite-wide `../CLAUDE.md` and the design in `../README.md` also apply.

## Commands
Tool versions come from `mise.toml`. The `@sbwp` packages come from `../platform` (`file:` dependencies) until they're on npm, so build platform first (`pnpm install && pnpm build` there) and re-run `pnpm install` here after changing it. From the repo root:
- `pnpm dev`: local Mongo, API (4102) and Vite (5102) with fake sign-in
- `pnpm test`: Vitest with 100% coverage. The `api` project runs handlers through the runtime wrapper against mongodb-memory-server; the `web` project runs in jsdom with fake auth and API clients from `@sbwp/web/testing`.
- `pnpm lint`, `pnpm format`, `pnpm typecheck`, `pnpm build`
- `pnpm types`: regenerate `api/routes.gen.ts` after changing routes. `pnpm typecheck` fails while it's stale.

## What this repo is
The `events` app: frontend, backend, and IaC in one repo. See README.md for its addresses, scopes, and status.

## Rules
- **The routes manifest (`defineApp`) is the source of truth** for routes, scopes, schedules, and Cognito groups. Never define routes, groups, or scopes anywhere else.
- **Follow the handler contract:** `handler(request, ctx)`, with zod schemas for `params`, `query`, and `body`. Handlers never touch raw Lambda events, AWS SDKs, or Mongo connection setup. Everything comes through `ctx`.
- **Use only this app's own database.** Other apps are reached through their APIs, never their databases.
- **Keep app-specific UI and logic here.** Anything another app would also need belongs in `platform`, but only once a second app actually needs it.
- **Use Mantine directly** with the platform base theme and this app's own primary color. No custom shared component layer.
- Events is the first app, so the `platform` packages are built alongside it. When Events needs something every app will need (auth routes, the handler wrapper, the API client), build it in `platform`, not here.
- Scopes: `events:guest` (base) and `events:host`. Hosts always also hold `events:guest`.
- Friends' names and emails never go in fixtures or seed data. Use obviously fake users (e.g. `alice@test`).
- Adding email notifications uses SES and costs money, so flag it first.
