-- Phase 1: human-friendly issue numbers (KEY#N per project) + author tracking.
-- Additive + idempotent; safe to run on a populated database.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS key text;
--> statement-breakpoint
ALTER TABLE projects ADD COLUMN IF NOT EXISTS issue_counter integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS number integer;
--> statement-breakpoint
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
--> statement-breakpoint

-- Backfill project keys: first 3 alphanumerics of the name, uppercased.
UPDATE projects
SET key = COALESCE(NULLIF(upper(substring(regexp_replace(name, '[^A-Za-z0-9]', '', 'g') FROM 1 FOR 3)), ''), 'PRJ')
WHERE key IS NULL OR key = '';
--> statement-breakpoint

-- Backfill per-project sequential numbers by creation order.
WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY project_id ORDER BY created_at, id) AS n
  FROM tasks
)
UPDATE tasks t SET number = numbered.n FROM numbered WHERE numbered.id = t.id AND t.number IS NULL;
--> statement-breakpoint

-- Seed each project's counter to its current max number.
UPDATE projects p
SET issue_counter = COALESCE((SELECT max(number) FROM tasks t WHERE t.project_id = p.id), 0);
