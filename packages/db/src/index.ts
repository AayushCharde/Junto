/**
 * @junto/db — shared Drizzle schema, client factories, and migrations.
 * Imported by both `apps/web` and (from Phase 6) `apps/mcp`.
 */

export * as schema from './schema';
export * from './schema';
export { createDb, type Database, type DbSchema } from './client';
export { createSupabaseAdmin } from './supabase-admin';
export * from './queries';
