/**
 * Local-embedding helpers for semantic search (Phase 7). Junto embeds text with
 * a local Ollama instance — no cloud AI, no keys, matching the "100% free"
 * goal. The `embeddings` column is 768-dim to match `nomic-embed-text`.
 *
 * These call Ollama's HTTP API and therefore only work where the caller can
 * reach the Ollama host: the backfill script (`pnpm db:embed`) and the
 * SvelteKit server in local dev. Cloudflare Workers cannot reach a machine's
 * localhost, so semantic search is unavailable in the deployed app (it falls
 * back to Postgres FTS).
 */

export const EMBED_MODEL = 'nomic-embed-text';
export const EMBED_DIM = 768;
export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

export interface EmbedOptions {
	/** Ollama base URL, e.g. http://localhost:11434 */
	url?: string;
	model?: string;
	signal?: AbortSignal;
}

/**
 * Embed a single string into a vector. Throws if Ollama is unreachable or
 * returns an unexpected shape — callers decide whether that's fatal.
 */
export async function embedText(text: string, opts: EmbedOptions = {}): Promise<number[]> {
	const base = (opts.url ?? DEFAULT_OLLAMA_URL).replace(/\/$/, '');
	const res = await fetch(`${base}/api/embeddings`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ model: opts.model ?? EMBED_MODEL, prompt: text }),
		signal: opts.signal
	});
	if (!res.ok) {
		throw new Error(`Ollama embeddings failed: ${res.status} ${res.statusText}`);
	}
	const data = (await res.json()) as { embedding?: unknown };
	if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
		throw new Error('Ollama returned no embedding');
	}
	return data.embedding as number[];
}

/** Format a JS vector as a pgvector literal, e.g. "[0.1,0.2,0.3]". */
export function toVectorLiteral(vec: number[]): string {
	return `[${vec.join(',')}]`;
}
