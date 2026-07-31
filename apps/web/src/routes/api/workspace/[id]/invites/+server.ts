import { error, json } from '@sveltejs/kit';
import { createInvite, isWorkspaceOwner, listInvites } from '@junto/db';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

/** List a workspace's invite links (owner only). */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const db = getDb();
	if (!(await isWorkspaceOwner(db, locals.user.id, params.id))) throw error(403, 'Forbidden');
	return json(await listInvites(db, params.id));
};

/** Create a shareable invite link (owner only). Invites join as 'member'. */
export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const db = getDb();
	if (!(await isWorkspaceOwner(db, locals.user.id, params.id))) throw error(403, 'Forbidden');
	const invite = await createInvite(db, params.id, 'member', locals.user.id);
	return json(invite, { status: 201 });
};
