import { error } from '@sveltejs/kit';
import { deleteLabel, userOwnsLabel } from '@junto/db';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const db = getDb();
	if (!(await userOwnsLabel(db, locals.user.id, params.id))) {
		throw error(403, 'Forbidden');
	}

	await deleteLabel(db, params.id);
	return new Response(null, { status: 204 });
};
