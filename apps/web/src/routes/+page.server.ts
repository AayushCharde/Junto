import { getDefaultWorkspace, listProjects, listTasksForWorkspace } from '@junto/db';
import { getDb } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const db = getDb();
	const workspace = await getDefaultWorkspace(db);
	if (!workspace) {
		return { workspace: null, projects: [], tasks: [] };
	}

	const [projects, tasks] = await Promise.all([
		listProjects(db, workspace.id),
		listTasksForWorkspace(db, workspace.id)
	]);

	return { workspace, projects, tasks };
};
