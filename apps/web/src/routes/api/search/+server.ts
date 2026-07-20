import { error, json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { embedText } from '@junto/core';
import { getWorkspaceForUser, searchTasks, semanticSearchTasks } from '@junto/db';
import type { Task } from '@junto/db';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

function shape(tasks: Task[]) {
	return tasks.map((t) => ({
		id: t.id,
		projectId: t.projectId,
		title: t.title,
		status: t.status,
		priority: t.priority,
		dueDate: t.dueDate
	}));
}

/**
 * Task search. Default mode is Postgres full-text search (works everywhere).
 * `mode=semantic` uses pgvector + a query embedding, but only when the server
 * can reach Ollama (OLLAMA_URL set); otherwise it transparently falls back to
 * FTS. The response echoes the `mode` actually used.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const q = (url.searchParams.get('q') ?? '').trim();
	const wantSemantic = url.searchParams.get('mode') === 'semantic';
	if (q.length < 2) return json({ mode: 'fts', tasks: [] });

	const db = getDb();
	const workspace = await getWorkspaceForUser(db, locals.user.id);
	if (!workspace) return json({ mode: 'fts', tasks: [] });

	if (wantSemantic && env.OLLAMA_URL) {
		try {
			const vector = await embedText(q, { url: env.OLLAMA_URL });
			const tasks = await semanticSearchTasks(db, workspace.id, vector);
			return json({ mode: 'semantic', tasks: shape(tasks) });
		} catch {
			// Ollama unreachable / errored — fall back to FTS below.
		}
	}

	const tasks = await searchTasks(db, workspace.id, q);
	return json({ mode: 'fts', tasks: shape(tasks) });
};
