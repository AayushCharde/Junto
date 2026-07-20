# Junto

A personal, keyboard-first task tracker (a Huly/Linear-style replacement) plus an
MCP server so tasks can be created and managed directly from Claude. 100% free to
run, 100% open-source, single Supabase Postgres database.

> **Status: Phase 6 complete.** The tracker (Phase 1), auth + RLS (Phase 2),
> metadata (Phase 3), comments + activity (Phase 4), the ⌘K speed layer (Phase 5),
> and the **MCP server** — a Cloudflare Worker exposing the tracker to Claude over
> bearer-authenticated Streamable HTTP (Phase 6) — are all wired up. Next: search
> & AI (Phase 7). See the build roadmap below.

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
  mcp/        # MCP server Worker (POST /mcp, bearer auth) → Cloudflare
packages/
  core/       # shared enums/types + Zod validation + task business logic
  db/         # Drizzle schema, migrations, RLS, seed, client factories
```

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

## MCP server (connect the tracker to Claude)

`apps/mcp` is a separate Cloudflare Worker that exposes the tracker to Claude over the Model
Context Protocol (Streamable HTTP, `POST /mcp`). It reuses the same schema and queries as the web
app and is authenticated with a single **bearer token**.

```bash
# local dev:
cp apps/mcp/.dev.vars.example apps/mcp/.dev.vars   # fill in DATABASE_URL + MCP_BEARER_TOKEN
pnpm mcp:dev                                        # http://localhost:8787/mcp

# deploy:
pnpm --filter @junto/mcp exec wrangler secret put DATABASE_URL
pnpm --filter @junto/mcp exec wrangler secret put MCP_BEARER_TOKEN   # e.g. `openssl rand -hex 32`
# optional — pin the workspace (defaults to the oldest one):
pnpm --filter @junto/mcp exec wrangler secret put MCP_WORKSPACE_ID
pnpm mcp:deploy
```

Then add it to Claude as a **custom connector / remote MCP server** with URL
`https://junto-mcp.<your-subdomain>.workers.dev/mcp` and header
`Authorization: Bearer <your token>`. Tools: `list_projects`, `list_tasks`, `create_task`,
`update_task`, `create_project`. Tasks created via Claude stream into the web UI live (Realtime).

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
| `pnpm mcp:dev`      | Run the MCP server Worker locally (`wrangler dev`) |
| `pnpm mcp:deploy`   | Deploy the MCP server Worker to Cloudflare          |

## Build roadmap

- **Phase 0 — Foundation** ✅
- **Phase 1 — The tracker**: projects, tasks, board + list views, optimistic UI, Realtime ✅
- **Phase 2 — Auth & RLS**: magic-link, enforce RLS, migrate seeded data to real user ✅
- **Phase 3 — Metadata**: labels, subtasks, due dates, drag-ordering, filters ✅
- **Phase 4 — Comments & activity** ✅
- **Phase 5 — Speed layer**: ⌘K command palette + keyboard shortcuts ✅
- **Phase 6 — MCP server**: `apps/mcp`, bearer auth, connect to Claude ✅
- **Phase 7 — Search & AI**: Postgres FTS, then pgvector + local Ollama
- **Phase 8 — Polish & ship**: PWA, production deploy, keep-alive cron
