import { createBrowserClient } from '@supabase/ssr';
import { env } from '$env/dynamic/public';

/**
 * Browser-side Supabase client. Used for auth (Phase 2) and Realtime
 * subscriptions (Phase 1). Reads public env at runtime so the same build can
 * point at different Supabase projects.
 */
export function createSupabaseBrowserClient() {
	return createBrowserClient(
		env.PUBLIC_SUPABASE_URL ?? '',
		env.PUBLIC_SUPABASE_ANON_KEY ?? ''
	);
}
