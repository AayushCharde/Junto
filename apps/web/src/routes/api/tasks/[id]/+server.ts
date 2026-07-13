import { error, json } from '@sveltejs/kit';
import { updateTaskSchema } from '@junto/core';
import { deleteTask, updateTask } from '@junto/db';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request }) => {
	const parsed = updateTaskSchema.safeParse(await request.json());
	if (!parsed.success) {
		throw error(400, 'Invalid task patch');
	}
	const row = await updateTask(getDb(), params.id, parsed.data);
	if (!row) {
		throw error(404, 'Task not found');
	}
	return json(row);
};

export const DELETE: RequestHandler = async ({ params }) => {
	await deleteTask(getDb(), params.id);
	return new Response(null, { status: 204 });
};
