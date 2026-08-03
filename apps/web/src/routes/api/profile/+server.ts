// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Aayush Charde

import { error, json } from '@sveltejs/kit';
import { updateProfileSchema } from '@junto/core';
import { updateProfileName } from '@junto/db';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

// A user may only edit their own profile.
export const PATCH: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const parsed = updateProfileSchema.safeParse(await request.json());
	if (!parsed.success) throw error(400, 'Invalid profile patch');

	const db = getDb();
	const row = await updateProfileName(db, locals.user.id, parsed.data.displayName);
	return json(row);
};
