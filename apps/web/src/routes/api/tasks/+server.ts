import { error, json } from '@sveltejs/kit';
import { createTaskSchema } from '@junto/core';
import { createTask, logActivity, userOwnsProject, workspaceIdForProject } from '@junto/db';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const parsed = createTaskSchema.safeParse(await request.json());
	if (!parsed.success) {
		throw error(400, 'Invalid task input');
	}

	const db = getDb();
	if (!(await userOwnsProject(db, locals.user.id, parsed.data.projectId))) {
		throw error(403, 'Forbidden');
	}

	const row = await createTask(db, parsed.data);

	// Subtasks are noisy in the feed; only log top-level task creation.
	if (!parsed.data.parentTaskId) {
		try {
			const workspaceId = await workspaceIdForProject(db, parsed.data.projectId);
			if (workspaceId) {
				await logActivity(db, {
					workspaceId,
					actorId: locals.user.id,
					entityType: 'task',
					entityId: row.id,
					action: 'created',
					meta: { title: row.title }
				});
			}
		} catch {
			/* non-fatal */
		}
	}

	return json(row, { status: 201 });
};
