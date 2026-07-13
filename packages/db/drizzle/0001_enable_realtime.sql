-- Enable Supabase Realtime for the tracker so changes (including those made via
-- the MCP server later) stream live to the UI. Idempotent.

-- Add tables to the realtime publication (guarded: adding twice errors).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE projects;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
-- Full row image on UPDATE/DELETE so Realtime payloads carry what the UI needs.
ALTER TABLE tasks REPLICA IDENTITY FULL;
--> statement-breakpoint
ALTER TABLE projects REPLICA IDENTITY FULL;
--> statement-breakpoint
-- Phase 1 is pre-auth: the browser subscribes with the anon role. Grant it read
-- access so Realtime delivers row changes. RLS (Phase 2) will re-scope this.
GRANT SELECT ON TABLE tasks TO anon, authenticated;
--> statement-breakpoint
GRANT SELECT ON TABLE projects TO anon, authenticated;
