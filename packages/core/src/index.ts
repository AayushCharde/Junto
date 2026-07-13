/**
 * @junto/core — shared types and (from Phase 1 onward) task business logic that
 * is reused by both `apps/web` and `apps/mcp` so behavior can never diverge.
 *
 * Phase 0 intentionally only exposes the shared domain enums. Business logic
 * (create/update/move task helpers, validation schemas) lands in Phase 1.
 */

export * from './enums';
