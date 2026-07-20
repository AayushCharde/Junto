# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Junto is

A personal, keyboard-first task tracker (Linear/Huly-style) plus an MCP server so tasks can be
managed from Claude. Single Supabase Postgres DB, deployed to Cloudflare Workers, 100% open-source.

Development follows a numbered phase roadmap (see README "Build roadmap"). Completed: Phase 1
(tracker), Phase 2 (auth + RLS), Phase 3 (labels, subtasks, due dates, drag-ordering, filters).
Next: Phase 4 (comments & activity). The `comments`, `activity`, and `embeddings` tables already
exist in the schema but are dormant until their phase. **The README's "Status: Phase 0" header is
stale — trust the git log and this file.**

## Commands

Run from repo root (pnpm workspaces):

```bash
pnpm dev            # web dev server → http://localhost:5173
pnpm build          # production build (Cloudflare adapter)
pnpm check          # type-check + svelte-check EVERY package (run before committing)
pnpm db:generate    # generate a Drizzle migration after editing schema.ts
pnpm db:migrate     # apply pending migrations in packages/db/drizzle/*.sql
pnpm db:seed        # seed pre-auth default user + "Personal" workspace + "Inbox" project
pnpm db:studio      # Drizzle Studio
pnpm mcp:dev        # run the MCP Worker locally (wrangler dev)
pnpm mcp:deploy     # deploy the MCP Worker to Cloudflare
```

Lint/format live in `apps/web` only: `pnpm --filter @junto/web lint` (prettier + eslint) and
`... format`. There is **no test suite** — verification is `pnpm check` plus manual testing.

A single repo-root `.env` serves both the web app (via Vite `envDir`) and DB tooling. See
`.env.example`. `DATABASE_URL` must be Supabase's **transaction pooler (port 6543)** for the app.

## Architecture

Four workspaces. The split exists so the web app and the MCP server share identical domain rules
and can never drift:

- **`packages/core`** — framework-free source of truth. Domain enums (`TASK_STATUSES`,
  `TASK_PRIORITIES` + label/order maps in `enums.ts`) and Zod schemas (`validation.ts`). The
  Postgres enums, the API validation, and the UI pickers all derive from these constants — change
  a status/priority here and it propagates everywhere.
- **`packages/db`** — Drizzle schema (`schema.ts`), all data-access functions (`queries.ts`),
  client factory (`client.ts`), Supabase admin helper, `rls.sql`, and migrate/seed scripts. Every
  query function takes a `Database` and is workspace/id-scoped **by the caller**.
- **`apps/web`** — SvelteKit (Svelte 5 runes) on Cloudflare Workers.
- **`apps/mcp`** — the MCP server (Phase 6): a standalone Cloudflare Worker exposing the tracker to
  Claude. See the MCP section below.

### Data flow (the important part)

1. **Initial load is server-side.** `routes/(app)/+layout.server.ts` calls `bootstrapUser`, then
   loads projects + tasks + labels + taskLabels for the workspace in one `Promise.all`, and passes
   them to the client. There is no per-route data fetching for the tracker.
2. **The client owns a single `TrackerStore`** (`lib/state/tracker.svelte.ts`), instantiated once in
   `(app)/+layout.svelte` and shared via Svelte context (`setTracker`/`getTracker`). It holds all
   `$state`, all selectors (filtering, subtask trees, dashboard aggregates), and all mutations.
   A second context store, `UiState` (`lib/state/ui.svelte.ts`), owns *UI* state — the ⌘K command
   palette, the Huly-style task composer, the shortcuts overlay, and which task the global editor
   is showing (`editingTaskId`). It exists so any route or the palette can open a task / start a
   new one without threading local component state. `TrackerStore` = data; `UiState` = surfaces.
3. **Mutations are optimistic.** Store methods mutate local `$state` first, `fetch` a
   `/routes/api/*` endpoint, then reconcile with the server row (`#upsertTask`) — or roll back the
   snapshot on failure. Client generates the UUID (`crypto.randomUUID()`) so optimistic rows and
   Realtime echoes reconcile by id. `sortOrder` uses `Date.now()` as a fractional key so
   drag-reorder never renumbers.
4. **Realtime keeps tabs in sync.** `startRealtime()` subscribes to Postgres changes on
   `tasks`/`projects`/`labels`/`task_labels` and applies the same upsert/remove reconcilers.
   Adding a Realtime-backed table requires a migration enabling it (see
   `0001_enable_realtime.sql`, `0003_labels_realtime.sql`).

### Auth & authorization (Phase 2 — subtle, read carefully)

- `hooks.server.ts` validates the JWT via `supabase.auth.getUser()` (not the raw cookie),
  populates `locals.user`, and redirects unauthenticated non-`/auth` routes to `/login` (API
  routes get `401`). `/login` and `/auth/*` are public.
- **RLS is enabled in Postgres (`0002_enable_rls.sql`) but the app's Drizzle connection uses the
  direct/pooler DB credentials, which bypass RLS.** Therefore every API route must authorize
  manually with the `userOwns{Workspace,Project,Task,Label}` helpers in `queries.ts` before
  mutating. This is the single most important invariant when adding endpoints — RLS is a
  defense-in-depth backstop, not the app's primary access control.
- First login runs `bootstrapUser`: ensures a profile, then adopts the pre-auth seeded workspace
  (via the Supabase service-role admin client) or creates a fresh `Personal`/`Inbox` workspace.

### MCP server (`apps/mcp`, Phase 6)

A standalone Cloudflare Worker (`src/index.ts`) that speaks the Model Context Protocol over
Streamable HTTP at `POST /mcp`, so Claude can manage tasks. Deliberately dependency-free — the
JSON-RPC transport is hand-rolled (`initialize`, `tools/list`, `tools/call`, `ping`; notifications
return 202). Tools live in `src/tools.ts` and reuse the **same** `@junto/core` Zod schemas and
`@junto/db` query functions as the web app — the whole reason for the workspace split.

- **Auth is a single static bearer token** (`MCP_BEARER_TOKEN`), compared in constant time. That
  token is the entire trust boundary: it authorizes one workspace (`MCP_WORKSPACE_ID`, else the
  oldest workspace via `getDefaultWorkspace`). Like the web app, the Worker's Drizzle connection
  bypasses RLS, so **every tool must scope to that workspace** — `create_task`/`update_task` verify
  the target project/task belongs to it via `workspaceIdFor{Project,Task}` before mutating.
- Tools: `list_projects`, `list_tasks`, `create_task`, `update_task`, `create_project`. Mutations
  write a best-effort `activity` row (`meta.via = 'mcp'`), so MCP actions show up live in the web
  feed via the existing Realtime subscription.
- Secrets (set with `wrangler secret put`): `DATABASE_URL`, `MCP_BEARER_TOKEN`, optional
  `MCP_WORKSPACE_ID`. Local dev uses `apps/mcp/.dev.vars` (see `.dev.vars.example`).
- `worker-configuration.d.ts` is generated by `wrangler types` (git-ignored); `check` runs it
  before `tsc`.

### Search (Phase 7)

Two layers behind `GET /api/search` (used by the ⌘K palette, debounced, with instant client-side
matches shown until the server responds):

- **FTS** (default, works on Cloudflare): migration `0005` adds a STORED generated `search_vector`
  tsvector on `tasks` (title weight A, description B) + GIN index. `searchTasks` queries it via raw
  `sql` with `websearch_to_tsquery`/`ts_rank`. The column is **not** in `schema.ts` (like RLS/realtime,
  it's raw-SQL-only) — never `select()` it through Drizzle.
- **Semantic** (`mode=semantic`, local only): `pgvector` + local Ollama. `@junto/core/ollama.ts`
  (`embedText`, 768-dim `nomic-embed-text`) is the only AI code; `pnpm db:embed` backfills the
  `embeddings` table; `semanticSearchTasks` orders by cosine distance (`<=>`, HNSW index). The
  endpoint uses it only when `OLLAMA_URL` is set **and** reachable, else it silently falls back to
  FTS — Workers can't reach a machine's localhost, so this is a dev/self-host feature.

Migrations `0001`–`0005` are hand-authored SQL (RLS, realtime, FTS, indexes) and are **not** produced
by `drizzle-kit generate`; their snapshots are copied forward. Author new infra migrations by hand,
add a `_journal.json` entry, and copy the latest snapshot — don't rely on `db:generate` for these.

### Conventions

- **API endpoints** (`routes/api/*/+server.ts`): check `locals.user` → 401, `safeParse` the body
  with a `@junto/core` Zod schema → 400, `userOwns*` check → 403, then call a `queries.ts` function.
  Keep business logic in `queries.ts`, never inline in the route.
- **DB is snake_case, app is camelCase.** Drizzle maps columns; the store's `mapTask`/`mapProject`
  helpers defensively read both casings because Realtime payloads arrive snake_case.
- **Svelte 5 runes only** (`$state`, `$props`, `$derived`) — no legacy stores for app state.
  UI primitives under `lib/components/ui` are shadcn-svelte (bits-ui + tailwind-variants).
- Two-palette theming (`cyan`/`graphite`) is SSR-applied from a `palette` cookie in `hooks.server.ts`
  to avoid flash. (`mode-watcher` is a dependency but is not currently mounted — the app is
  dark-default; the palette cookie is the live theme switch.)
- **Speed layer (Phase 5)**: global keyboard handling lives on `<svelte:window>` in
  `(app)/+layout.svelte` (⌘K palette, `c` new task, `b`/`l` views, `g h` home, `?` help). New tasks
  go through the Huly-style `task-composer.svelte` (title + description + inline status/priority/due/
  label pills + "Create more"), which calls `store.createDetailedTask` (one POST for the task, then
  label links). The command palette, composer, editor, and shortcuts overlay are all mounted once in
  the `(app)` layout and driven by `UiState`.
- Cloudflare Workers: create one Drizzle client **per request** (`getDb()`), never module-scoped;
  `prepare: false` is required for the transaction pooler.
