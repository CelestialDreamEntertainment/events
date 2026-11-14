# Events
Scheduling for events I host with friends, part of the apps suite. Invited friends sign in to see events and RSVP.

> **Status:** not scaffolded yet. Events is the first app, so the first version of the platform is built around what it needs. The shared design lives in the suite README (`../README.md`).

## Addresses
| Environment | URL |
|---|---|
| Prod | `https://events.app.sabrinabea.com` |
| Dev | `https://events.dev.sabrinabea.com` |
| Local | `https://events.local.sabrinabea.com` (ports 4102 backend / 5102 frontend) |

## Access
- **Scopes:** `events:guest` (the base scope, required by every non-public route) and `events:host`. Hosts also hold `events:guest`.
- **Examples:** creating an event requires `events:host`. Handlers can use `user.has('events:host')` for finer-grained behavior, like hosts seeing every RSVP while guests see only their own.
- **Invites:** friends are invited with the `platform-infra` invite script, e.g. `pnpm invite friend@example.com --group events:guest --env prod`, and later through the Admin app.

## Structure (planned)
- **Frontend:** React + Vite + Mantine (including `@mantine/dates`), with the platform `web` package's auth client and typed API client.
- **Backend:** a TypeScript routes manifest (`defineApp`) plus one handler file per route. Likely scheduled jobs, such as reminders, go in the manifest's `schedules` section.
- **IaC:** Terraform using the pinned `platform` modules (`app-api`, `static-site`, `app-auth`).
- **Data:** the `events` database on the environment's Atlas cluster. Nothing else reads it.
- **Email:** any notifications go through SES and are flagged for cost before they're added.

## Development
Planned: `pnpm dev` starts local Mongo, the local API, and Vite, with fake sign-in by default. Tick `events:guest` or `events:host` on the dev sign-in page to switch roles. Other standard scripts: `pnpm test`, `pnpm lint`, `pnpm build`.

## Releases
Merging to main deploys to dev. Prod deploys after manual approval on the GitHub `prod` environment and gets a date tag. PR titles follow Conventional Commits.
