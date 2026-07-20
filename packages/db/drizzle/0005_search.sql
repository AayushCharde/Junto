-- Phase 7: search. Two layers.
--
-- 1) Postgres full-text search over tasks. A STORED generated `search_vector`
--    (title weighted A, description B) kept in sync by Postgres, with a GIN
--    index. This column is intentionally NOT in the Drizzle schema — the app
--    never reads/writes it directly; searchTasks() queries it via raw SQL.
--
-- 2) pgvector indexes for semantic search over the (Phase 0) embeddings table.
--    A unique key on (entity_type, entity_id) so embeddings upsert cleanly, and
--    an HNSW cosine index for fast nearest-neighbour lookups. Embeddings are
--    produced by a local Ollama backfill (`pnpm db:embed`); semantic search is
--    only reachable where the server can talk to Ollama (local dev / self-host).

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS tasks_search_vector_idx ON tasks USING gin (search_vector);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS embeddings_entity_unique ON embeddings (entity_type, entity_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS embeddings_embedding_hnsw ON embeddings USING hnsw (embedding vector_cosine_ops);
