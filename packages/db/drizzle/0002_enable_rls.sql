-- Phase 2: enable + enforce Row-Level Security. Ownership-based: a row is
-- reachable only through a workspace whose owner_id = auth.uid(). The app's
-- own Drizzle connection uses the table-owner role and bypasses RLS (it scopes
-- queries manually); these policies govern the browser/Realtime (authenticated)
-- path. Source of truth: packages/db/src/rls.sql.

ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "profiles_self" ON "profiles" FOR ALL TO authenticated
  USING ("id" = auth.uid()) WITH CHECK ("id" = auth.uid());--> statement-breakpoint

ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "workspaces_owner" ON "workspaces" FOR ALL TO authenticated
  USING ("owner_id" = auth.uid()) WITH CHECK ("owner_id" = auth.uid());--> statement-breakpoint

ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "projects_via_workspace" ON "projects" FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM "workspaces" w WHERE w."id" = "projects"."workspace_id" AND w."owner_id" = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM "workspaces" w WHERE w."id" = "projects"."workspace_id" AND w."owner_id" = auth.uid()));--> statement-breakpoint

ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tasks_via_workspace" ON "tasks" FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM "projects" p JOIN "workspaces" w ON w."id" = p."workspace_id" WHERE p."id" = "tasks"."project_id" AND w."owner_id" = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM "projects" p JOIN "workspaces" w ON w."id" = p."workspace_id" WHERE p."id" = "tasks"."project_id" AND w."owner_id" = auth.uid()));--> statement-breakpoint

ALTER TABLE "labels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "labels_via_workspace" ON "labels" FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM "workspaces" w WHERE w."id" = "labels"."workspace_id" AND w."owner_id" = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM "workspaces" w WHERE w."id" = "labels"."workspace_id" AND w."owner_id" = auth.uid()));--> statement-breakpoint

ALTER TABLE "task_labels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "task_labels_via_workspace" ON "task_labels" FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM "tasks" t JOIN "projects" p ON p."id" = t."project_id" JOIN "workspaces" w ON w."id" = p."workspace_id" WHERE t."id" = "task_labels"."task_id" AND w."owner_id" = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM "tasks" t JOIN "projects" p ON p."id" = t."project_id" JOIN "workspaces" w ON w."id" = p."workspace_id" WHERE t."id" = "task_labels"."task_id" AND w."owner_id" = auth.uid()));--> statement-breakpoint

ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "comments_via_workspace" ON "comments" FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM "tasks" t JOIN "projects" p ON p."id" = t."project_id" JOIN "workspaces" w ON w."id" = p."workspace_id" WHERE t."id" = "comments"."task_id" AND w."owner_id" = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM "tasks" t JOIN "projects" p ON p."id" = t."project_id" JOIN "workspaces" w ON w."id" = p."workspace_id" WHERE t."id" = "comments"."task_id" AND w."owner_id" = auth.uid()));--> statement-breakpoint

ALTER TABLE "activity" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "activity_via_workspace" ON "activity" FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM "workspaces" w WHERE w."id" = "activity"."workspace_id" AND w."owner_id" = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM "workspaces" w WHERE w."id" = "activity"."workspace_id" AND w."owner_id" = auth.uid()));--> statement-breakpoint

-- Dormant, no direct owner column: deny-all to authenticated; only the
-- service role (server AI jobs, Phase 7) touches it.
ALTER TABLE "embeddings" ENABLE ROW LEVEL SECURITY;
