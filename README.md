# Junto

A personal, keyboard-first task tracker (a Huly/Linear-style replacement) plus an
MCP server so tasks can be created and managed directly from Claude. 100% free to
run, 100% open-source, single Supabase Postgres database.

> **Status: Phase 4 complete.** The tracker (Phase 1), auth + RLS (Phase 2),
> metadata — labels/subtasks/due dates/drag-ordering/filters (Phase 3), and
> comments + an activity feed (Phase 4) are all wired up. Next: the ⌘K speed
> layer (Phase 5). See the build roadmap below.

## Stack

| Concern      | Choice                                                             |
| ------------ | ----------------------------------------------------------------- |
| Framework    | SvelteKit · Svelte 5 (runes) · TypeScript strict                  |
| Deploy       | Cloudflare Workers via `@sveltejs/adapter-cloudflare`             |
| Database     | Supabase Postgres · Drizzle ORM · `pgvector` (dormant until AI)   |
| Auth         | Supabase Auth (magic-link) — wired, enforced from Phase 2         |
| UI           | Tailwind CSS v4 · shadcn-svelte · lucide · Inter · dark default   |
| Realtime     | Supabase Realtime (Phase 1)                                       |
| MCP server   | Cloudflare Worker, streamable-http `/mcp` (Phase 6)               |
| Tooling      | pnpm workspaces · Zod                                             |

## Repository layout

```
apps/
  web/        # SvelteKit app (UI + app API) → Cloudflare
packages/
  core/       # shared enums/types + (from Phase 1) task business logic
  db/         # Drizzle schema, migrations, RLS, seed, client factories
```

`apps/mcp` (the MCP Worker) is added in Phase 6.

## Prerequisites

- **Node ≥ 20** (developed on Node 24).
- **pnpm** — `corepack enable pnpm` (or install any 10/11.x).
- A free **Supabase** account and a free **Cloudflare** account.

## One-time setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Create a free Supabase project

1. https://supabase.com → **New project** (free tier). Pick a region near you and
   set a database password.
2. In the dashboard, collect:
   - **Project Settings → API**: `Project URL`, `anon` public key, `service_role` key.
   - **Project Settings → Database → Connection string**: use the
     **Transaction pooler** URI (port `6543`) for the app; the direct connection
     (`5432`) is fine for local migrate/seed.
   - `pgvector` is created automatically by the first migration
     (`CREATE EXTENSION IF NOT EXISTS "vector"`).

### 3. Configure environment

Copy the example and fill in your values:

```bash
cp .env.example .env
```

A single repo-root `.env` serves **both** the web app (via Vite `envDir`) and the
DB tooling. See `.env.example` for every variable. For the Cloudflare
`wrangler dev` preview only, also `cp apps/web/.dev.vars.example apps/web/.dev.vars`.

### 4. Create the schema and seed the default user

```bash
pnpm db:migrate   # applies packages/db/drizzle/*.sql to your database
pnpm db:seed      # creates the pre-auth default user + "Personal" workspace + "Inbox" project
```

> RLS policies live in `packages/db/src/rls.sql`. They are **not** applied yet —
> they are enforced starting in Phase 2 (auth). Until then the app runs against
> the seeded default data via a direct Drizzle connection.

### 5. Run locally

```bash
pnpm dev          # SvelteKit dev server (http://localhost:5173)
```

## Deploy to Cloudflare

The web app deploys as a Cloudflare Worker (config in `apps/web/wrangler.jsonc`,
`nodejs_compat` enabled for postgres.js).

```bash
# from apps/web — first time, authenticate:
pnpm --filter @junto/web exec wrangler login

# set production secrets (repeat for each):
pnpm --filter @junto/web exec wrangler secret put DATABASE_URL
pnpm --filter @junto/web exec wrangler secret put SUPABASE_SERVICE_ROLE_KEY
pnpm --filter @junto/web exec wrangler secret put PUBLIC_SUPABASE_URL
pnpm --filter @junto/web exec wrangler secret put PUBLIC_SUPABASE_ANON_KEY

# build + deploy:
pnpm --filter @junto/web build
pnpm --filter @junto/web exec wrangler deploy
```

Your app will be live at `https://junto-web.<your-subdomain>.workers.dev`.

## Scripts (run from repo root)

| Command             | Description                                        |
| ------------------- | -------------------------------------------------- |
| `pnpm dev`          | Start the web dev server                           |
| `pnpm build`        | Production build of the web app (Cloudflare)       |
| `pnpm check`        | Type-check every workspace package                 |
| `pnpm db:generate`  | Generate a new Drizzle migration from the schema   |
| `pnpm db:migrate`   | Apply pending migrations                            |
| `pnpm db:seed`      | Seed the default user/workspace/project            |
| `pnpm db:studio`    | Open Drizzle Studio                                |
| `pnpm db:push`      | Push schema directly (dev shortcut; prefer migrate)|

## Build roadmap

- **Phase 0 — Foundation** ✅
- **Phase 1 — The tracker**: projects, tasks, board + list views, optimistic UI, Realtime ✅
- **Phase 2 — Auth & RLS**: magic-link, enforce RLS, migrate seeded data to real user ✅
- **Phase 3 — Metadata**: labels, subtasks, due dates, drag-ordering, filters ✅
- **Phase 4 — Comments & activity** ✅
- **Phase 5 — Speed layer**: ⌘K command palette + keyboard shortcuts
- **Phase 6 — MCP server**: `apps/mcp`, bearer auth, connect to Claude
- **Phase 7 — Search & AI**: Postgres FTS, then pgvector + local Ollama
- **Phase 8 — Polish & ship**: PWA, production deploy, keep-alive cron
