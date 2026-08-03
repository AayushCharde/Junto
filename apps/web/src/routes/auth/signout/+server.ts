// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Aayush Charde

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	await locals.supabase.auth.signOut();
	redirect(303, '/login?signedout');
};
