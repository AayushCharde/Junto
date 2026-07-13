import { error, json } from '@sveltejs/kit';
import { createTaskSchema } from '@junto/core';
import { createTask } from '@junto/db';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const parsed = createTaskSchema.safeParse(await request.json());
	if (!parsed.success) {
		throw error(400, 'Invalid task input');
	}
	const row = await createTask(getDb(), parsed.data);
	return json(row, { status: 201 });
};
