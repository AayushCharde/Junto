import { error, json } from '@sveltejs/kit';
import { createLabelSchema } from '@junto/core';
import { createLabel, userOwnsWorkspace } from '@junto/db';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const parsed = createLabelSchema.safeParse(await request.json());
	if (!parsed.success) {
		throw error(400, 'Invalid label input');
	}

	const db = getDb();
	if (!(await userOwnsWorkspace(db, locals.user.id, parsed.data.workspaceId))) {
		throw error(403, 'Forbidden');
	}

	const row = await createLabel(db, parsed.data);
	return json(row, { status: 201 });
};
