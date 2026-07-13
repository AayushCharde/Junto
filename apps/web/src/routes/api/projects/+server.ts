import { error, json } from '@sveltejs/kit';
import { createProjectSchema } from '@junto/core';
import { createProject } from '@junto/db';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const parsed = createProjectSchema.safeParse(await request.json());
	if (!parsed.success) {
		throw error(400, 'Invalid project input');
	}
	const row = await createProject(getDb(), parsed.data);
	return json(row, { status: 201 });
};
