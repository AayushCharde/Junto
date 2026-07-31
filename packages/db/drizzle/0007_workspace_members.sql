-- Phase 2 (MR1): multi-user foundation — workspace membership + invite links.
-- Access control moves from ownership (workspaces.owner_id) to membership.
-- Additive + idempotent; safe to run on a populated database.

-- ── Tables ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS workspace_members_user_id_idx ON workspace_members(user_id);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  token text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS workspace_invites_workspace_id_idx ON workspace_invites(workspace_id);
--> statement-breakpoint

-- ── Backfill: every existing workspace's owner becomes an 'owner' member ──────
INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT id, owner_id, 'owner' FROM workspaces
ON CONFLICT (workspace_id, user_id) DO NOTHING;
--> statement-breakpoint

-- ── RLS rewrite: ownership → membership (defense-in-depth; the app bypasses) ──
-- The data tables become reachable by any member of the workspace. The
-- membership/invite tables stay gated on workspace ownership to avoid
-- self-referential RLS recursion (owners manage members; members read via the
-- app's RLS-bypassing connection).

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "workspace_members_owner" ON workspace_members;
--> statement-breakpoint
CREATE POLICY "workspace_members_owner" ON workspace_members
  FOR ALL TO authenticated
  USING (exists (select 1 from workspaces w where w.id = workspace_members.workspace_id and w.owner_id = auth.uid()))
  WITH CHECK (exists (select 1 from workspaces w where w.id = workspace_members.workspace_id and w.owner_id = auth.uid()));
--> statement-breakpoint

ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "workspace_invites_owner" ON workspace_invites;
--> statement-breakpoint
CREATE POLICY "workspace_invites_owner" ON workspace_invites
  FOR ALL TO authenticated
  USING (exists (select 1 from workspaces w where w.id = workspace_invites.workspace_id and w.owner_id = auth.uid()))
  WITH CHECK (exists (select 1 from workspaces w where w.id = workspace_invites.workspace_id and w.owner_id = auth.uid()));
--> statement-breakpoint

-- workspaces: a member (of any role) may read/update; keep it simple.
DROP POLICY IF EXISTS "workspaces_owner" ON workspaces;
--> statement-breakpoint
DROP POLICY IF EXISTS "workspaces_member" ON workspaces;
--> statement-breakpoint
CREATE POLICY "workspaces_member" ON workspaces
  FOR ALL TO authenticated
  USING (exists (select 1 from workspace_members m where m.workspace_id = workspaces.id and m.user_id = auth.uid()))
  WITH CHECK (exists (select 1 from workspace_members m where m.workspace_id = workspaces.id and m.user_id = auth.uid()));
--> statement-breakpoint

-- projects: reachable through a workspace the user is a member of.
DROP POLICY IF EXISTS "projects_via_workspace" ON projects;
--> statement-breakpoint
CREATE POLICY "projects_via_workspace" ON projects
  FOR ALL TO authenticated
  USING (exists (select 1 from workspace_members m where m.workspace_id = projects.workspace_id and m.user_id = auth.uid()))
  WITH CHECK (exists (select 1 from workspace_members m where m.workspace_id = projects.workspace_id and m.user_id = auth.uid()));
--> statement-breakpoint

-- tasks: reachable through project -> workspace membership.
DROP POLICY IF EXISTS "tasks_via_workspace" ON tasks;
--> statement-breakpoint
CREATE POLICY "tasks_via_workspace" ON tasks
  FOR ALL TO authenticated
  USING (exists (
    select 1 from projects p
    join workspace_members m on m.workspace_id = p.workspace_id
    where p.id = tasks.project_id and m.user_id = auth.uid()))
  WITH CHECK (exists (
    select 1 from projects p
    join workspace_members m on m.workspace_id = p.workspace_id
    where p.id = tasks.project_id and m.user_id = auth.uid()));
--> statement-breakpoint

-- labels: reachable through workspace membership.
DROP POLICY IF EXISTS "labels_via_workspace" ON labels;
--> statement-breakpoint
CREATE POLICY "labels_via_workspace" ON labels
  FOR ALL TO authenticated
  USING (exists (select 1 from workspace_members m where m.workspace_id = labels.workspace_id and m.user_id = auth.uid()))
  WITH CHECK (exists (select 1 from workspace_members m where m.workspace_id = labels.workspace_id and m.user_id = auth.uid()));
--> statement-breakpoint

-- task_labels: reachable through task -> project -> workspace membership.
DROP POLICY IF EXISTS "task_labels_via_workspace" ON task_labels;
--> statement-breakpoint
CREATE POLICY "task_labels_via_workspace" ON task_labels
  FOR ALL TO authenticated
  USING (exists (
    select 1 from tasks t
    join projects p on p.id = t.project_id
    join workspace_members m on m.workspace_id = p.workspace_id
    where t.id = task_labels.task_id and m.user_id = auth.uid()))
  WITH CHECK (exists (
    select 1 from tasks t
    join projects p on p.id = t.project_id
    join workspace_members m on m.workspace_id = p.workspace_id
    where t.id = task_labels.task_id and m.user_id = auth.uid()));
--> statement-breakpoint

-- comments: reachable through task -> project -> workspace membership.
DROP POLICY IF EXISTS "comments_via_workspace" ON comments;
--> statement-breakpoint
CREATE POLICY "comments_via_workspace" ON comments
  FOR ALL TO authenticated
  USING (exists (
    select 1 from tasks t
    join projects p on p.id = t.project_id
    join workspace_members m on m.workspace_id = p.workspace_id
    where t.id = comments.task_id and m.user_id = auth.uid()))
  WITH CHECK (exists (
    select 1 from tasks t
    join projects p on p.id = t.project_id
    join workspace_members m on m.workspace_id = p.workspace_id
    where t.id = comments.task_id and m.user_id = auth.uid()));
--> statement-breakpoint

-- activity: append-only feed, reachable through workspace membership.
DROP POLICY IF EXISTS "activity_via_workspace" ON activity;
--> statement-breakpoint
CREATE POLICY "activity_via_workspace" ON activity
  FOR ALL TO authenticated
  USING (exists (select 1 from workspace_members m where m.workspace_id = activity.workspace_id and m.user_id = auth.uid()))
  WITH CHECK (exists (select 1 from workspace_members m where m.workspace_id = activity.workspace_id and m.user_id = auth.uid()));
