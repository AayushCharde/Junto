import { redirect } from '@sveltejs/kit';
import {
	getProfile,
	listActivityForWorkspace,
	listCommentsForWorkspace,
	listLabels,
	listProjects,
	listTaskLabels,
	listTasksForWorkspace
} from '@junto/db';
import { getDb } from '$lib/server/db';
import { bootstrapUser } from '$lib/server/auth';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) {
		redirect(303, '/login');
	}

	const db = getDb();
	const workspace = await bootstrapUser(db, user);

	const [projects, tasks, labels, taskLabels, comments, activity, profile] = await Promise.all([
		listProjects(db, workspace.id),
		listTasksForWorkspace(db, workspace.id),
		listLabels(db, workspace.id),
		listTaskLabels(db, workspace.id),
		listCommentsForWorkspace(db, workspace.id),
		listActivityForWorkspace(db, workspace.id),
		getProfile(db, user.id)
	]);

	return {
		user: { id: user.id, email: user.email ?? null, displayName: profile?.displayName ?? null },
		workspace,
		projects,
		tasks,
		labels,
		taskLabels,
		comments,
		activity
	};
};
