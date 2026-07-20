/**
 * Backfills task embeddings for semantic search (Phase 7). Reads every task,
 * embeds "title + description" with a local Ollama, and upserts into the
 * `embeddings` table. Idempotent — safe to re-run; only changed content
 * produces a new vector.
 *
 * Requires a reachable Ollama (OLLAMA_URL, default http://localhost:11434) with
 * the embedding model pulled: `ollama pull nomic-embed-text`.
 * Run with: pnpm db:embed
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { DEFAULT_OLLAMA_URL, EMBED_MODEL, embedText } from '@junto/core';
import { createDb } from '../src/client';
import { listTasksForEmbedding, upsertEmbedding } from '../src/queries';

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error('DATABASE_URL is not set. Add it to the repo-root .env file.');
	process.exit(1);
}
const ollamaUrl = process.env.OLLAMA_URL ?? DEFAULT_OLLAMA_URL;

const db = createDb(DATABASE_URL);
const tasks = await listTasksForEmbedding(db);
console.log(`Embedding ${tasks.length} task(s) via ${ollamaUrl} (${EMBED_MODEL})…`);

let done = 0;
for (const task of tasks) {
	const content = [task.title, task.description ?? ''].join('\n').trim();
	if (!content) continue;
	try {
		const vector = await embedText(content, { url: ollamaUrl });
		await upsertEmbedding(db, 'task', task.id, content, vector);
		done++;
	} catch (err) {
		console.error(
			`\nFailed to embed task ${task.id}. Is Ollama running at ${ollamaUrl} with "${EMBED_MODEL}" pulled?`
		);
		console.error(err instanceof Error ? err.message : err);
		process.exit(1);
	}
}

console.log(`Embedded ${done} task(s).`);
process.exit(0);
