import { error, json } from '@sveltejs/kit';
import { createCommentSchema } from '@junto/core';
import {
	createComment,
	logActivity,
	userOwnsTask,
	workspaceIdForTask
} from '@junto/db';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const parsed = createCommentSchema.safeParse(await request.json());
	if (!parsed.success || parsed.data.taskId !== params.id) {
		throw error(400, 'Invalid comment input');
	}

	const db = getDb();
	if (!(await userOwnsTask(db, locals.user.id, params.id))) {
		throw error(403, 'Forbidden');
	}

	const row = await createComment(db, { ...parsed.data, authorId: locals.user.id });

	// Best-effort audit entry — never fail the write because logging failed.
	try {
		const workspaceId = await workspaceIdForTask(db, params.id);
		if (workspaceId) {
			await logActivity(db, {
				workspaceId,
				actorId: locals.user.id,
				entityType: 'task',
				entityId: params.id,
				action: 'commented',
				meta: { commentId: row.id }
			});
		}
	} catch {
		/* non-fatal */
	}

	return json(row, { status: 201 });
};
