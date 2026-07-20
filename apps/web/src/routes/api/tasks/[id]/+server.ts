import { error, json } from '@sveltejs/kit';
import { updateTaskSchema } from '@junto/core';
import {
	deleteTask,
	logActivity,
	updateTask,
	userOwnsTask,
	workspaceIdForTask
} from '@junto/db';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const parsed = updateTaskSchema.safeParse(await request.json());
	if (!parsed.success) {
		throw error(400, 'Invalid task patch');
	}

	const db = getDb();
	if (!(await userOwnsTask(db, locals.user.id, params.id))) {
		throw error(403, 'Forbidden');
	}

	const row = await updateTask(db, params.id, parsed.data);
	if (!row) {
		throw error(404, 'Task not found');
	}

	// A pure drag-reorder (only sortOrder) is not feed-worthy; skip it.
	const fields = Object.keys(parsed.data);
	const worthLogging = fields.some((f) => f !== 'sortOrder');
	if (worthLogging) {
		try {
			const workspaceId = await workspaceIdForTask(db, params.id);
			if (workspaceId) {
				const statusChanged = parsed.data.status !== undefined;
				await logActivity(db, {
					workspaceId,
					actorId: locals.user.id,
					entityType: 'task',
					entityId: row.id,
					action: statusChanged ? 'status_changed' : 'updated',
					meta: statusChanged
						? { to: row.status, title: row.title }
						: { title: row.title, fields }
				});
			}
		} catch {
			/* non-fatal */
		}
	}

	return json(row);
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const db = getDb();
	if (!(await userOwnsTask(db, locals.user.id, params.id))) {
		throw error(403, 'Forbidden');
	}

	// Resolve the workspace before the row disappears.
	let workspaceId: string | null = null;
	try {
		workspaceId = await workspaceIdForTask(db, params.id);
	} catch {
		/* non-fatal */
	}

	await deleteTask(db, params.id);

	if (workspaceId) {
		try {
			await logActivity(db, {
				workspaceId,
				actorId: locals.user.id,
				entityType: 'task',
				entityId: params.id,
				action: 'deleted'
			});
		} catch {
			/* non-fatal */
		}
	}

	return new Response(null, { status: 204 });
};
