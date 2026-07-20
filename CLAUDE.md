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
```

Lint/format live in `apps/web` only: `pnpm --filter @junto/web lint` (prettier + eslint) and
`... format`. There is **no test suite** — verification is `pnpm check` plus manual testing.

A single repo-root `.env` serves both the web app (via Vite `envDir`) and DB tooling. See
`.env.example`. `DATABASE_URL` must be Supabase's **transaction pooler (port 6543)** for the app.

## Architecture

Three workspaces. The split exists so the web app and the future MCP server share identical
domain rules and can never drift:

- **`packages/core`** — framework-free source of truth. Domain enums (`TASK_STATUSES`,
  `TASK_PRIORITIES` + label/order maps in `enums.ts`) and Zod schemas (`validation.ts`). The
  Postgres enums, the API validation, and the UI pickers all derive from these constants — change
  a status/priority here and it propagates everywhere.
- **`packages/db`** — Drizzle schema (`schema.ts`), all data-access functions (`queries.ts`),
  client factory (`client.ts`), Supabase admin helper, `rls.sql`, and migrate/seed scripts. Every
  query function takes a `Database` and is workspace/id-scoped **by the caller**.
- **`apps/web`** — SvelteKit (Svelte 5 runes) on Cloudflare Workers.

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
