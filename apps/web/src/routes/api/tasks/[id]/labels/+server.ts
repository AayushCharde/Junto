import { error } from '@sveltejs/kit';
import { taskLabelSchema } from '@junto/core';
import { addTaskLabel, userOwnsLabel, userOwnsTask } from '@junto/db';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const parsed = taskLabelSchema.safeParse(await request.json());
	if (!parsed.success) {
		throw error(400, 'Invalid label reference');
	}

	const db = getDb();
	const [ownsTask, ownsLabel] = await Promise.all([
		userOwnsTask(db, locals.user.id, params.id),
		userOwnsLabel(db, locals.user.id, parsed.data.labelId)
	]);
	if (!ownsTask || !ownsLabel) {
		throw error(403, 'Forbidden');
	}

	await addTaskLabel(db, params.id, parsed.data.labelId);
	return new Response(null, { status: 204 });
};
