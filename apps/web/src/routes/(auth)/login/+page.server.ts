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
			// Supabase throttles magic-link emails (esp. the built-in sender). Show a
			// calm, actionable message instead of the raw "email rate limit exceeded".
			const rateLimited =
				error.status === 429 ||
				error.code === 'over_email_send_rate_limit' ||
				/rate limit/i.test(error.message);
			return fail(rateLimited ? 429 : 400, {
				email,
				message: rateLimited
					? "Too many sign-in emails just now. Wait a minute and try again — and check your inbox, a link we already sent may be waiting."
					: error.message
			});
		}

		return { success: true, email };
	}
};
