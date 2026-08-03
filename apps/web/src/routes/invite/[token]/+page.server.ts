// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Aayush Charde

import { redirect } from '@sveltejs/kit';
import { acceptInvite } from '@junto/db';
import { getDb } from '$lib/server/db';
import type { PageServerLoad } from './$types';

/**
 * Shareable invite landing. If the visitor is signed in we redeem the invite
 * immediately and drop them into the workspace. If not, we stash the token in a
 * short-lived cookie and bounce to /login — `bootstrapUser` redeems it on the
 * first authenticated load (see lib/server/auth.ts + the (app) layout).
 */
export const load: PageServerLoad = async ({ params, locals, cookies }) => {
	const token = params.token;

	if (!locals.user) {
		cookies.set('junto-invite', token, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 30 // 30 minutes to complete the magic-link round-trip
		});
		redirect(303, '/login?invite=1');
	}

	const db = getDb();
	const result = await acceptInvite(db, token, locals.user.id);
	if (result.ok) {
		redirect(303, '/');
	}
	return { reason: result.reason };
};
