// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Aayush Charde

import { error, json } from '@sveltejs/kit';
import { updateLabelSchema } from '@junto/core';
import { deleteLabel, updateLabel, userOwnsLabel } from '@junto/db';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const parsed = updateLabelSchema.safeParse(await request.json());
	if (!parsed.success) throw error(400, 'Invalid label patch');

	const db = getDb();
	if (!(await userOwnsLabel(db, locals.user.id, params.id))) {
		throw error(403, 'Forbidden');
	}

	const row = await updateLabel(db, params.id, parsed.data);
	if (!row) throw error(404, 'Label not found');
	return json(row);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const db = getDb();
	if (!(await userOwnsLabel(db, locals.user.id, params.id))) {
		throw error(403, 'Forbidden');
	}

	await deleteLabel(db, params.id);
	return new Response(null, { status: 204 });
};
