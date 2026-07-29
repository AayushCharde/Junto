import { error, json } from '@sveltejs/kit';
import { updateProjectSchema } from '@junto/core';
import { deleteProject, updateProject, userOwnsProject } from '@junto/db';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const parsed = updateProjectSchema.safeParse(await request.json());
	if (!parsed.success) throw error(400, 'Invalid project patch');

	const db = getDb();
	if (!(await userOwnsProject(db, locals.user.id, params.id))) {
		throw error(403, 'Forbidden');
	}

	const row = await updateProject(db, params.id, parsed.data);
	if (!row) throw error(404, 'Project not found');
	return json(row);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const db = getDb();
	if (!(await userOwnsProject(db, locals.user.id, params.id))) {
		throw error(403, 'Forbidden');
	}

	await deleteProject(db, params.id);
	return new Response(null, { status: 204 });
};
