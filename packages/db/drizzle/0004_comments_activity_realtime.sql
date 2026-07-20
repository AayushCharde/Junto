-- Phase 4: stream comment + activity changes to the UI. RLS for both tables was
-- already enabled in 0002; this only wires them into Supabase Realtime and grants
-- the authenticated (browser) role read access. Idempotent.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE comments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE activity;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
-- Full row image on UPDATE/DELETE so Realtime payloads carry what the UI needs.
ALTER TABLE comments REPLICA IDENTITY FULL;
--> statement-breakpoint
ALTER TABLE activity REPLICA IDENTITY FULL;
--> statement-breakpoint
GRANT SELECT ON TABLE comments TO authenticated;
--> statement-breakpoint
GRANT SELECT ON TABLE activity TO authenticated;
