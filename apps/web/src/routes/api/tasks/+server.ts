import { error, json } from '@sveltejs/kit';
import { createTaskSchema } from '@junto/core';
import { createTask, userOwnsProject } from '@junto/db';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const parsed = createTaskSchema.safeParse(await request.json());
	if (!parsed.success) {
		throw error(400, 'Invalid task input');
	}

	const db = getDb();
	if (!(await userOwnsProject(db, locals.user.id, parsed.data.projectId))) {
		throw error(403, 'Forbidden');
	}

	const row = await createTask(db, parsed.data);
	return json(row, { status: 201 });
};
