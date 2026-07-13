/**
 * Drizzle client factory. Both the SvelteKit app and the MCP Worker create a
 * client per request from their platform's `DATABASE_URL` secret.
 *
 * Notes for Cloudflare Workers:
 *  - postgres.js runs on Workers with the `nodejs_compat` flag enabled.
 *  - Use Supabase's transaction-mode pooler (port 6543) and keep `prepare:false`
 *    — prepared statements aren't supported in transaction pooling mode.
 *  - Create one client per request and let it be GC'd; do not hold pools in
 *    module scope (Workers isolates have no reliable long-lived state).
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type DbSchema = typeof schema;

export function createDb(connectionString: string) {
	const client = postgres(connectionString, {
		// Required for Supabase's transaction-mode pooler.
		prepare: false,
		// One connection per isolate/request on the edge.
		max: 1
	});
	return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;
