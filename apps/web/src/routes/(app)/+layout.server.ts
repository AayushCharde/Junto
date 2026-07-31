import { redirect } from '@sveltejs/kit';
import {
	getProfile,
	listActivityForWorkspace,
	listCommentsForWorkspace,
	listLabels,
	listMembers,
	listProjects,
	listTaskLabels,
	listTasksForWorkspace
} from '@junto/db';
import { getDb } from '$lib/server/db';
import { bootstrapUser } from '$lib/server/auth';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
	const { user } = await locals.safeGetSession();
	if (!user) {
		redirect(303, '/login');
	}

	const db = getDb();

	// Redeem a pending invite captured while logged out (see /invite/[token]).
	const inviteToken = cookies.get('junto-invite') ?? null;
	if (inviteToken) cookies.delete('junto-invite', { path: '/' });

	const workspace = await bootstrapUser(db, user, inviteToken);
	const isOwner = workspace.ownerId === user.id;

	const [projects, tasks, labels, taskLabels, comments, activity, profile, members] =
		await Promise.all([
			listProjects(db, workspace.id),
			listTasksForWorkspace(db, workspace.id),
			listLabels(db, workspace.id),
			listTaskLabels(db, workspace.id),
			listCommentsForWorkspace(db, workspace.id),
			listActivityForWorkspace(db, workspace.id),
			getProfile(db, user.id),
			listMembers(db, workspace.id)
		]);

	return {
		user: { id: user.id, email: user.email ?? null, displayName: profile?.displayName ?? null },
		workspace,
		isOwner,
		projects,
		tasks,
		labels,
		taskLabels,
		comments,
		activity,
		members
	};
};
