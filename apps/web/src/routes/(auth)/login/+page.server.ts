// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Aayush Charde

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		redirect(303, '/');
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals, url, cookies }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const remember = form.get('remember') != null;
		if (!email) {
			return fail(400, { message: 'Enter your email address.' });
		}

		// Persist the preference so /auth/callback (where the session is actually
		// created, after the link is clicked) can choose persistent vs session
		// cookies. See createSupabaseServerClient. Session-only when unchecked so
		// the cookie itself clears on browser close too.
		cookies.set('junto-remember', remember ? '1' : '0', {
			path: '/',
			...(remember ? { maxAge: 60 * 60 * 24 * 400 } : {})
		});

		const { error } = await locals.supabase.auth.signInWithOtp({
			email,
			options: { emailRedirectTo: `${url.origin}/auth/callback` }
		});

		if (error) {
			const msg = error.message ?? '';
			// Supabase throttles magic-link emails (esp. the built-in sender)…
			const rateLimited =
				error.status === 429 || error.code === 'over_email_send_rate_limit' || /rate limit/i.test(msg);
			// …and the whole project is unreachable if it's paused/offline (the auth
			// host stops resolving → "fetch failed" with status 0).
			const unreachable =
				!rateLimited &&
				(error.status === 0 || /fetch failed|failed to fetch|network|ENOTFOUND|ETIMEDOUT/i.test(msg));

			return fail(rateLimited ? 429 : unreachable ? 503 : 400, {
				email,
				message: rateLimited
					? "Too many sign-in emails just now. Wait a minute and try again — and check your inbox, a link we already sent may be waiting."
					: unreachable
						? "Can't reach the server right now. Check your connection and try again in a moment — if it keeps failing, the database may be paused."
						: msg
			});
		}

		return { success: true, email };
	}
};
