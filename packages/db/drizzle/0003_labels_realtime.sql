-- Stream label + task_label changes to the UI (e.g. labels applied via MCP later).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE labels;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE task_labels;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE labels REPLICA IDENTITY FULL;
--> statement-breakpoint
ALTER TABLE task_labels REPLICA IDENTITY FULL;
--> statement-breakpoint
GRANT SELECT ON TABLE labels TO authenticated;
--> statement-breakpoint
GRANT SELECT ON TABLE task_labels TO authenticated;
