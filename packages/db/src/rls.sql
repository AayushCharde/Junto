-- ===========================================================================
-- Junto Row-Level Security policies
-- ===========================================================================
-- These policies are written NOW (Phase 0) alongside the schema but are only
-- ENFORCED starting in Phase 2 (auth). This file is the source of truth; in
-- Phase 2 it becomes a Drizzle migration.
--
-- Model: ownership-based multi-tenancy. Every row ultimately belongs to a
-- workspace, and a workspace is owned by exactly one auth.users row. The
-- `authenticated` role may only touch rows in workspaces it owns; `auth.uid()`
-- resolves to the current user. The `service_role` bypasses RLS entirely.
--
-- Do NOT run this during Phase 0/1: the pre-auth app talks to Postgres over a
-- direct Drizzle connection (which bypasses RLS), and the browser Realtime
-- subscription uses the anon key — enabling these policies before auth exists
-- would hide the seeded default data.
-- ===========================================================================

-- profiles: a user sees and edits only their own profile row.
alter table "profiles" enable row level security;
create policy "profiles_self" on "profiles"
  for all to authenticated
  using ("id" = auth.uid())
  with check ("id" = auth.uid());

-- workspaces: owner-only.
alter table "workspaces" enable row level security;
create policy "workspaces_owner" on "workspaces"
  for all to authenticated
  using ("owner_id" = auth.uid())
  with check ("owner_id" = auth.uid());

-- projects: reachable only through an owned workspace.
alter table "projects" enable row level security;
create policy "projects_via_workspace" on "projects"
  for all to authenticated
  using (exists (
    select 1 from "workspaces" w
    where w."id" = "projects"."workspace_id" and w."owner_id" = auth.uid()
  ))
  with check (exists (
    select 1 from "workspaces" w
    where w."id" = "projects"."workspace_id" and w."owner_id" = auth.uid()
  ));

-- tasks: reachable through project -> workspace.
alter table "tasks" enable row level security;
create policy "tasks_via_workspace" on "tasks"
  for all to authenticated
  using (exists (
    select 1 from "projects" p
    join "workspaces" w on w."id" = p."workspace_id"
    where p."id" = "tasks"."project_id" and w."owner_id" = auth.uid()
  ))
  with check (exists (
    select 1 from "projects" p
    join "workspaces" w on w."id" = p."workspace_id"
    where p."id" = "tasks"."project_id" and w."owner_id" = auth.uid()
  ));

-- labels: reachable through workspace.
alter table "labels" enable row level security;
create policy "labels_via_workspace" on "labels"
  for all to authenticated
  using (exists (
    select 1 from "workspaces" w
    where w."id" = "labels"."workspace_id" and w."owner_id" = auth.uid()
  ))
  with check (exists (
    select 1 from "workspaces" w
    where w."id" = "labels"."workspace_id" and w."owner_id" = auth.uid()
  ));

-- task_labels: reachable through task -> project -> workspace.
alter table "task_labels" enable row level security;
create policy "task_labels_via_workspace" on "task_labels"
  for all to authenticated
  using (exists (
    select 1 from "tasks" t
    join "projects" p on p."id" = t."project_id"
    join "workspaces" w on w."id" = p."workspace_id"
    where t."id" = "task_labels"."task_id" and w."owner_id" = auth.uid()
  ))
  with check (exists (
    select 1 from "tasks" t
    join "projects" p on p."id" = t."project_id"
    join "workspaces" w on w."id" = p."workspace_id"
    where t."id" = "task_labels"."task_id" and w."owner_id" = auth.uid()
  ));

-- comments: reachable through task -> project -> workspace.
alter table "comments" enable row level security;
create policy "comments_via_workspace" on "comments"
  for all to authenticated
  using (exists (
    select 1 from "tasks" t
    join "projects" p on p."id" = t."project_id"
    join "workspaces" w on w."id" = p."workspace_id"
    where t."id" = "comments"."task_id" and w."owner_id" = auth.uid()
  ))
  with check (exists (
    select 1 from "tasks" t
    join "projects" p on p."id" = t."project_id"
    join "workspaces" w on w."id" = p."workspace_id"
    where t."id" = "comments"."task_id" and w."owner_id" = auth.uid()
  ));

-- activity: append-only feed, reachable through workspace.
alter table "activity" enable row level security;
create policy "activity_via_workspace" on "activity"
  for all to authenticated
  using (exists (
    select 1 from "workspaces" w
    where w."id" = "activity"."workspace_id" and w."owner_id" = auth.uid()
  ))
  with check (exists (
    select 1 from "workspaces" w
    where w."id" = "activity"."workspace_id" and w."owner_id" = auth.uid()
  ));

-- embeddings: no direct owner column and dormant until Phase 7. Enable RLS with
-- no authenticated policy => deny-all to non-privileged roles; only the
-- service_role (used by server-side AI jobs) can touch it. Revisit in Phase 7.
alter table "embeddings" enable row level security;
