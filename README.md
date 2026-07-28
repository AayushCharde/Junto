<div align="center">

# Junto

**A keyboard-first task tracker — with a built-in MCP server so Claude can manage your work.**

Boards, lists, subtasks, labels, comments and a ⌘K command palette — plus full-text & semantic
search, realtime sync, and a PWA. 100% open-source, runs entirely on free tiers.

[![SvelteKit](https://img.shields.io/badge/SvelteKit-Svelte_5-ff3e00?logo=svelte&logoColor=white)](https://kit.svelte.dev)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ecf8e?logo=supabase&logoColor=white)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![MCP](https://img.shields.io/badge/MCP-Claude_%26_Cursor-6366f1)](#mcp--connect-claude--cursor)
[![License: MIT](https://img.shields.io/badge/License-MIT-a1a1aa)](LICENSE)

**[Live demo](https://junto-web.junto-work.workers.dev)** · [Quick start](#quick-start) · [Architecture](#architecture) · [Connect Claude](#mcp--connect-claude--cursor)

</div>

![Junto sign-in](.github/assets/hero.png)

> **Junto** — Spanish for *"together"*, and the name of Benjamin Franklin's 1727 club for mutual
> improvement. It's a personal, Linear/Huly-style tracker that keeps your projects, tasks and
> discussions in one fast, keyboard-driven space — and exposes them to AI assistants over the
> Model Context Protocol.

---

## Features

- **⌨️ Keyboard-first speed layer** — a ⌘K command palette (fuzzy search over actions, projects and
  tasks) and shortcuts (`c` new task, `b`/`l` board/list, `g h` home, `?` help). A Huly-style
  composer creates tasks with inline status/priority/due/label pills.
- **🗂 Full tracker** — projects, tasks, **board & list** views, drag-to-reorder, subtasks, labels,
  due dates and filters. A view-first task detail with inline editing.
- **💬 Comments & activity** — threaded comments and an append-only activity feed per task and
  workspace-wide.
- **🔎 Search** — Postgres full-text search everywhere, plus optional **pgvector + local Ollama**
  semantic search.
- **🤖 MCP server** — a standalone Worker that lets **Claude & Cursor** list, create and update
  tasks. Changes stream back into the UI live.
- **⚡ Realtime & optimistic UI** — every change applies instantly and syncs across tabs/devices via
  Supabase Realtime.
- **🔐 Auth & RLS** — magic-link auth with Postgres Row-Level Security (defense-in-depth) and manual
  ownership checks on every endpoint.
- **📱 PWA** — installable, with an offline shell.

## Tech stack

| Concern    | Choice                                                          |
| ---------- | --------------------------------------------------------------- |
| Framework  | SvelteKit · Svelte 5 (runes) · TypeScript (strict)              |
| Deploy     | Cloudflare Workers (`@sveltejs/adapter-cloudflare`)             |
| Database   | Supabase Postgres · Drizzle ORM · `pgvector`                    |
| Auth       | Supabase Auth (magic-link) + Row-Level Security                 |
| UI         | Tailwind CSS v4 · shadcn-svelte · lucide · Inter · dark-default |
| Realtime   | Supabase Realtime                                               |
| AI / MCP   | Model Context Protocol over Streamable HTTP · local Ollama      |
| Tooling    | pnpm workspaces · Zod                                           |

## Architecture

A pnpm monorepo of four workspaces. The split exists so the web app and the MCP server share
**identical domain rules** (enums, Zod validation, DB queries) and can never drift.

```
apps/
  web/     # SvelteKit app (UI + JSON API)          → Cloudflare Worker
  mcp/     # MCP server (POST /mcp, bearer auth)     → Cloudflare Worker
packages/
  core/    # framework-free enums, Zod schemas, Ollama embedding helper
  db/      # Drizzle schema, queries, migrations, RLS, seed/embed scripts
```

The client owns a single optimistic store; the server loads all workspace data once, mutations hit
`/api/*`, and Supabase Realtime reconciles. RLS is enforced in Postgres, but because the app's
Drizzle connection bypasses it, **every endpoint authorizes ownership manually**. A deeper tour
lives in [`CLAUDE.md`](CLAUDE.md).

## Quick start

**Prerequisites:** Node ≥ 20, `pnpm` (`corepack enable pnpm`), and free Supabase + Cloudflare accounts.

```bash
pnpm install
cp .env.example .env        # fill in Supabase URL/keys + DATABASE_URL (transaction pooler, :6543)
pnpm db:migrate             # apply migrations
pnpm db:seed                # seed default workspace + Inbox project
pnpm dev                    # → http://localhost:5173
```

Run `pnpm check` (type-check + svelte-check across every package) before committing. See
[`.env.example`](.env.example) for every variable; a single repo-root `.env` serves both the web app
and DB tooling.

## Deployment

Both apps deploy as Cloudflare Workers; Supabase hosts the database.

```bash
# authenticate once
pnpm --filter @junto/web exec wrangler login

# web app — set secrets, then deploy
pnpm --filter @junto/web exec wrangler secret put DATABASE_URL
pnpm --filter @junto/web exec wrangler secret put SUPABASE_URL
pnpm --filter @junto/web exec wrangler secret put SUPABASE_SERVICE_ROLE_KEY
pnpm --filter @junto/web exec wrangler secret put PUBLIC_SUPABASE_URL
pnpm --filter @junto/web exec wrangler secret put PUBLIC_SUPABASE_ANON_KEY
pnpm build && pnpm --filter @junto/web exec wrangler deploy

# MCP server — set secrets, then deploy (also registers the keep-alive cron)
pnpm --filter @junto/mcp exec wrangler secret put DATABASE_URL
pnpm --filter @junto/mcp exec wrangler secret put MCP_BEARER_TOKEN   # e.g. `openssl rand -hex 32`
pnpm mcp:deploy
```

**Keep-alive (free-tier Supabase).** Free projects pause after ~a week idle. Two guards, use either:
the MCP Worker's daily Cron Trigger (`select 1`, comes with `pnpm mcp:deploy`), or a GitHub
Actions workflow at `.github/workflows/keepalive.yml` (add `SUPABASE_URL` + `SUPABASE_ANON_KEY`
repo secrets — no deploy needed).

## MCP — connect Claude & Cursor

The `apps/mcp` Worker speaks the Model Context Protocol over Streamable HTTP at `POST /mcp`,
authenticated by a single bearer token. Tools: `list_projects`, `list_tasks`, `create_task`,
`update_task`, `create_project`. The in-app **MCP** tab generates ready-to-paste config.

**Cursor** — `~/.cursor/mcp.json`:

```jsonc
{
  "mcpServers": {
    "junto": {
      "url": "https://<your-worker>.workers.dev/mcp",
      "headers": { "Authorization": "Bearer YOUR_MCP_BEARER_TOKEN" }
    }
  }
}
```

**Claude Desktop** — `claude_desktop_config.json` (via `mcp-remote`, which bridges the remote
server + bearer header):

```jsonc
{
  "mcpServers": {
    "junto": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://<your-worker>.workers.dev/mcp",
               "--header", "Authorization: Bearer YOUR_MCP_BEARER_TOKEN"]
    }
  }
}
```

## Search

`GET /api/search` powers the ⌘K palette. **Full-text search** (a Postgres `tsvector` + GIN index)
works everywhere. **Semantic search** uses `pgvector` + a local Ollama (`nomic-embed-text`); run
`pnpm db:embed` to backfill, and it transparently falls back to FTS where Ollama isn't reachable
(e.g. the deployed edge).

## Scripts

| Command            | Description                                        |
| ------------------ | -------------------------------------------------- |
| `pnpm dev`         | Web dev server                                     |
| `pnpm build`       | Production build (Cloudflare adapter)              |
| `pnpm check`       | Type-check every workspace                         |
| `pnpm db:migrate`  | Apply pending migrations                           |
| `pnpm db:seed`     | Seed default user/workspace/project                |
| `pnpm db:embed`    | Backfill task embeddings via local Ollama          |
| `pnpm mcp:dev`     | Run the MCP Worker locally                         |
| `pnpm mcp:deploy`  | Deploy the MCP Worker (+ keep-alive cron)          |

## License

[MIT](LICENSE) © Aayush Charde
