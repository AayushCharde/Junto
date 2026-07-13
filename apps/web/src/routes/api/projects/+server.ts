import { error, json } from '@sveltejs/kit';
import { createProjectSchema } from '@junto/core';
import { createProject, userOwnsWorkspace } from '@junto/db';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const parsed = createProjectSchema.safeParse(await request.json());
	if (!parsed.success) {
		throw error(400, 'Invalid project input');
	}

	const db = getDb();
	if (!(await userOwnsWorkspace(db, locals.user.id, parsed.data.workspaceId))) {
		throw error(403, 'Forbidden');
	}

	const row = await createProject(db, parsed.data);
	return json(row, { status: 201 });
};
