-- ===========================================================================
-- Junto Row-Level Security policies
-- ===========================================================================
-- Source of truth for the RLS model. As of Phase 2 (MR1) access control is
-- MEMBERSHIP-based: every data row belongs to a workspace, and a workspace is
-- reachable by every row in `workspace_members`. The live policies are applied
-- by migrations `0002` (initial, ownership) and `0007` (rewrite to membership);
-- this file mirrors the current (post-0007) state.
--
-- RLS is defense-in-depth only: the app (and MCP Worker) talk to Postgres over a
-- direct Drizzle connection that BYPASSES RLS, so real enforcement is the
-- `userOwns*` (now membership) checks in queries.ts. `auth.uid()` resolves to
-- the current user; `service_role` bypasses RLS entirely.
--
-- The membership/invite tables are gated on workspace OWNERSHIP (not membership)
-- to avoid self-referential RLS recursion.
-- ===========================================================================

-- profiles: a user sees and edits only their own profile row.
alter table "profiles" enable row level security;
create policy "profiles_self" on "profiles"
  for all to authenticated
  using ("id" = auth.uid())
  with check ("id" = auth.uid());

-- workspace_members: managed by the workspace owner.
alter table "workspace_members" enable row level security;
create policy "workspace_members_owner" on "workspace_members"
  for all to authenticated
  using (exists (select 1 from "workspaces" w where w."id" = "workspace_members"."workspace_id" and w."owner_id" = auth.uid()))
  with check (exists (select 1 from "workspaces" w where w."id" = "workspace_members"."workspace_id" and w."owner_id" = auth.uid()));

-- workspace_invites: managed by the workspace owner.
alter table "workspace_invites" enable row level security;
create policy "workspace_invites_owner" on "workspace_invites"
  for all to authenticated
  using (exists (select 1 from "workspaces" w where w."id" = "workspace_invites"."workspace_id" and w."owner_id" = auth.uid()))
  with check (exists (select 1 from "workspaces" w where w."id" = "workspace_invites"."workspace_id" and w."owner_id" = auth.uid()));

-- workspaces: any member may access.
alter table "workspaces" enable row level security;
create policy "workspaces_member" on "workspaces"
  for all to authenticated
  using (exists (select 1 from "workspace_members" m where m."workspace_id" = "workspaces"."id" and m."user_id" = auth.uid()))
  with check (exists (select 1 from "workspace_members" m where m."workspace_id" = "workspaces"."id" and m."user_id" = auth.uid()));

-- projects: reachable through a workspace the user is a member of.
alter table "projects" enable row level security;
create policy "projects_via_workspace" on "projects"
  for all to authenticated
  using (exists (select 1 from "workspace_members" m where m."workspace_id" = "projects"."workspace_id" and m."user_id" = auth.uid()))
  with check (exists (select 1 from "workspace_members" m where m."workspace_id" = "projects"."workspace_id" and m."user_id" = auth.uid()));

-- tasks: reachable through project -> workspace membership.
alter table "tasks" enable row level security;
create policy "tasks_via_workspace" on "tasks"
  for all to authenticated
  using (exists (
    select 1 from "projects" p
    join "workspace_members" m on m."workspace_id" = p."workspace_id"
    where p."id" = "tasks"."project_id" and m."user_id" = auth.uid()
  ))
  with check (exists (
    select 1 from "projects" p
    join "workspace_members" m on m."workspace_id" = p."workspace_id"
    where p."id" = "tasks"."project_id" and m."user_id" = auth.uid()
  ));

-- labels: reachable through workspace membership.
alter table "labels" enable row level security;
create policy "labels_via_workspace" on "labels"
  for all to authenticated
  using (exists (select 1 from "workspace_members" m where m."workspace_id" = "labels"."workspace_id" and m."user_id" = auth.uid()))
  with check (exists (select 1 from "workspace_members" m where m."workspace_id" = "labels"."workspace_id" and m."user_id" = auth.uid()));

-- task_labels: reachable through task -> project -> workspace membership.
alter table "task_labels" enable row level security;
create policy "task_labels_via_workspace" on "task_labels"
  for all to authenticated
  using (exists (
    select 1 from "tasks" t
    join "projects" p on p."id" = t."project_id"
    join "workspace_members" m on m."workspace_id" = p."workspace_id"
    where t."id" = "task_labels"."task_id" and m."user_id" = auth.uid()
  ))
  with check (exists (
    select 1 from "tasks" t
    join "projects" p on p."id" = t."project_id"
    join "workspace_members" m on m."workspace_id" = p."workspace_id"
    where t."id" = "task_labels"."task_id" and m."user_id" = auth.uid()
  ));

-- comments: reachable through task -> project -> workspace membership.
alter table "comments" enable row level security;
create policy "comments_via_workspace" on "comments"
  for all to authenticated
  using (exists (
    select 1 from "tasks" t
    join "projects" p on p."id" = t."project_id"
    join "workspace_members" m on m."workspace_id" = p."workspace_id"
    where t."id" = "comments"."task_id" and m."user_id" = auth.uid()
  ))
  with check (exists (
    select 1 from "tasks" t
    join "projects" p on p."id" = t."project_id"
    join "workspace_members" m on m."workspace_id" = p."workspace_id"
    where t."id" = "comments"."task_id" and m."user_id" = auth.uid()
  ));

-- activity: append-only feed, reachable through workspace membership.
alter table "activity" enable row level security;
create policy "activity_via_workspace" on "activity"
  for all to authenticated
  using (exists (select 1 from "workspace_members" m where m."workspace_id" = "activity"."workspace_id" and m."user_id" = auth.uid()))
  with check (exists (select 1 from "workspace_members" m where m."workspace_id" = "activity"."workspace_id" and m."user_id" = auth.uid()));

-- embeddings: no direct owner column and dormant until Phase 7. Enable RLS with
-- no authenticated policy => deny-all to non-privileged roles; only the
-- service_role (used by server-side AI jobs) can touch it. Revisit in Phase 7.
alter table "embeddings" enable row level security;
