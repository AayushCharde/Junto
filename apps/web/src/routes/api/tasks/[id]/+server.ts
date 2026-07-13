import { error, json } from '@sveltejs/kit';
import { updateTaskSchema } from '@junto/core';
import { deleteTask, updateTask, userOwnsTask } from '@junto/db';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const parsed = updateTaskSchema.safeParse(await request.json());
	if (!parsed.success) {
		throw error(400, 'Invalid task patch');
	}

	const db = getDb();
	if (!(await userOwnsTask(db, locals.user.id, params.id))) {
		throw error(403, 'Forbidden');
	}

	const row = await updateTask(db, params.id, parsed.data);
	if (!row) {
		throw error(404, 'Task not found');
	}
	return json(row);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const db = getDb();
	if (!(await userOwnsTask(db, locals.user.id, params.id))) {
		throw error(403, 'Forbidden');
	}

	await deleteTask(db, params.id);
	return new Response(null, { status: 204 });
};
