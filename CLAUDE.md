# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The suite-wide `../CLAUDE.md` and the design in `../README.md` also apply. This repo is not scaffolded yet, so there are no commands. Add them here once they exist. Planned: `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm build`.

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
