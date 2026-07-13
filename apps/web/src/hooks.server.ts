import type { Handle } from '@sveltejs/kit';
import { createSupabaseServerClient } from '$lib/supabase/server';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createSupabaseServerClient(event);

	/**
	 * Validates the JWT with Supabase (getUser) rather than trusting the cookie
	 * session blindly. Returns nulls when unauthenticated. Auth is only enforced
	 * from Phase 2; Phase 0/1 run against the seeded default user.
	 */
	event.locals.safeGetSession = async () => {
		const {
			data: { session }
		} = await event.locals.supabase.auth.getSession();
		if (!session) {
			return { session: null, user: null };
		}

		const {
			data: { user },
			error
		} = await event.locals.supabase.auth.getUser();
		if (error) {
			return { session: null, user: null };
		}

		return { session, user };
	};

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};
