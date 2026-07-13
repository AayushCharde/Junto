import { createServerClient } from '@supabase/ssr';
import { env } from '$env/dynamic/public';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Per-request server-side Supabase client that reads/writes auth cookies through
 * SvelteKit. Instantiated in hooks.server.ts and exposed as `event.locals.supabase`.
 *
 * Placeholder fallbacks keep the app bootable before Supabase is configured
 * (the Phase 0 landing page never touches auth); real values come from the
 * repo-root .env / Cloudflare secrets.
 */
export function createSupabaseServerClient(event: RequestEvent) {
	return createServerClient(
		env.PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
		env.PUBLIC_SUPABASE_ANON_KEY || 'anon-key-not-set',
		{
			cookies: {
				getAll: () => event.cookies.getAll(),
				setAll: (cookiesToSet) => {
					for (const { name, value, options } of cookiesToSet) {
						event.cookies.set(name, value, { ...options, path: '/' });
					}
				}
			}
		}
	);
}
