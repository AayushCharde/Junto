import { env } from '$env/dynamic/private';
import { createDb, type Database } from '@junto/db';

/**
 * Server-only Drizzle client factory. Lives under `$lib/server` so SvelteKit
 * guarantees it is never bundled into the browser. Creates one client per call;
 * on Cloudflare Workers that means one per request.
 */
export function getDb(): Database {
	const url = env.DATABASE_URL;
	if (!url) {
		throw new Error('DATABASE_URL is not set. Add it to the repo-root .env / Cloudflare secrets.');
	}
	return createDb(url);
}
