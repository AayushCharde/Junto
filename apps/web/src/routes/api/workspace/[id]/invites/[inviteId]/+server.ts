import { error, json } from '@sveltejs/kit';
import { getInviteById, isWorkspaceOwner, revokeInvite } from '@junto/db';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

/** Revoke (delete) an invite link (owner only). */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const db = getDb();
	if (!(await isWorkspaceOwner(db, locals.user.id, params.id))) throw error(403, 'Forbidden');

	// The invite must belong to the workspace in the path.
	const invite = await getInviteById(db, params.inviteId);
	if (!invite || invite.workspaceId !== params.id) throw error(404, 'Invite not found');

	await revokeInvite(db, params.inviteId);
	return json({ ok: true });
};
