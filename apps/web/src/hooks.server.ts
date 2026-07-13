import { redirect, type Handle } from '@sveltejs/kit';
import { createSupabaseServerClient } from '$lib/supabase/server';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = createSupabaseServerClient(event);

	/**
	 * Validates the JWT with Supabase (getUser) rather than trusting the cookie
	 * session blindly. Returns nulls when unauthenticated.
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

	const { session, user } = await event.locals.safeGetSession();
	event.locals.session = session;
	event.locals.user = user;

	// Route protection. Auth pages (login + the /auth/* handlers) stay public.
	const path = event.url.pathname;
	const isAuthRoute = path === '/login' || path.startsWith('/auth');

	if (!user && !isAuthRoute) {
		if (path.startsWith('/api')) {
			return new Response('Unauthorized', { status: 401 });
		}
		redirect(303, '/login');
	}
	if (user && path === '/login') {
		redirect(303, '/');
	}

	// Palette preference (SSR-applied from a cookie so there's no flash and no
	// reliance on localStorage). Defaults to the cyan palette.
	const palette = event.cookies.get('palette') === 'graphite' ? 'graphite' : 'cyan';

	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace('data-palette="cyan"', `data-palette="${palette}"`),
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};
