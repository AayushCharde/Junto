import { error, json } from '@sveltejs/kit';
import { isWorkspaceOwner, removeMember } from '@junto/db';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

/** Remove a member from a workspace (owner only; the owner can't be removed). */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const db = getDb();
	if (!(await isWorkspaceOwner(db, locals.user.id, params.id))) throw error(403, 'Forbidden');

	await removeMember(db, params.id, params.userId);
	return json({ ok: true });
};
