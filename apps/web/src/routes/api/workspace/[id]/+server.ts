// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Aayush Charde

import { error, json } from '@sveltejs/kit';
import { updateWorkspaceSchema } from '@junto/core';
import { isWorkspaceOwner, updateWorkspace } from '@junto/db';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const parsed = updateWorkspaceSchema.safeParse(await request.json());
	if (!parsed.success) throw error(400, 'Invalid workspace patch');

	const db = getDb();
	if (!(await isWorkspaceOwner(db, locals.user.id, params.id))) {
		throw error(403, 'Forbidden');
	}

	const row = await updateWorkspace(db, params.id, parsed.data);
	if (!row) throw error(404, 'Workspace not found');
	return json(row);
};
