/**
 * Junto MCP server — a Cloudflare Worker exposing the tracker to Claude over the
 * Model Context Protocol (Streamable HTTP, POST /mcp). Stateless JSON-RPC:
 * `initialize`, `tools/list`, `tools/call`, `ping`. Auth is a static bearer
 * token (MCP_BEARER_TOKEN); the token authorizes access to a single workspace
 * (MCP_WORKSPACE_ID, else the oldest workspace in the database).
 *
 * A minimal hand-rolled transport keeps the Worker dependency-free; the protocol
 * surface here is small and stable.
 */

import { createDb, getDefaultWorkspace, pingDb, type Database } from '@junto/db';
import { TOOLS, ToolError, type ToolDef } from './tools';

interface Environment {
	DATABASE_URL: string;
	MCP_BEARER_TOKEN: string;
	MCP_WORKSPACE_ID?: string;
}

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'junto', version: '0.1.0' };

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'authorization, content-type, mcp-session-id, mcp-protocol-version'
};

interface RpcRequest {
	jsonrpc: '2.0';
	id?: string | number | null;
	method: string;
	params?: Record<string, unknown>;
}

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', ...CORS }
	});
}

function ok(id: RpcRequest['id'], result: unknown) {
	return { jsonrpc: '2.0' as const, id: id ?? null, result };
}

function err(id: RpcRequest['id'], code: number, message: string) {
	return { jsonrpc: '2.0' as const, id: id ?? null, error: { code, message } };
}

/** Length-safe constant-time-ish token comparison. */
function tokenMatches(provided: string, expected: string): boolean {
	if (!expected || provided.length !== expected.length) return false;
	let diff = 0;
	for (let i = 0; i < provided.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
	return diff === 0;
}

async function resolveWorkspaceId(db: Database, env: Environment): Promise<string | null> {
	if (env.MCP_WORKSPACE_ID) return env.MCP_WORKSPACE_ID;
	const ws = await getDefaultWorkspace(db);
	return ws?.id ?? null;
}

async function callTool(
	tool: ToolDef,
	args: Record<string, unknown>,
	db: Database,
	workspaceId: string
) {
	try {
		const result = await tool.run(args, { db, workspaceId });
		return {
			content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
			isError: false
		};
	} catch (e) {
		const message = e instanceof ToolError ? e.message : 'Internal error running tool.';
		return { content: [{ type: 'text', text: message }], isError: true };
	}
}

async function handleMessage(
	msg: RpcRequest,
	db: Database,
	env: Environment
): Promise<object | null> {
	const isNotification = msg.id === undefined || msg.id === null;

	switch (msg.method) {
		case 'initialize':
			return ok(msg.id, {
				protocolVersion: PROTOCOL_VERSION,
				capabilities: { tools: {} },
				serverInfo: SERVER_INFO
			});

		case 'notifications/initialized':
		case 'notifications/cancelled':
			return null; // notifications get no response

		case 'ping':
			return ok(msg.id, {});

		case 'tools/list':
			return ok(msg.id, {
				tools: TOOLS.map((t) => ({
					name: t.name,
					description: t.description,
					inputSchema: t.inputSchema
				}))
			});

		case 'tools/call': {
			const name = msg.params?.name as string | undefined;
			const args = (msg.params?.arguments as Record<string, unknown>) ?? {};
			const tool = TOOLS.find((t) => t.name === name);
			if (!tool) return err(msg.id, -32602, `Unknown tool: ${name}`);
			const workspaceId = await resolveWorkspaceId(db, env);
			if (!workspaceId) return err(msg.id, -32603, 'No workspace found in the database.');
			return ok(msg.id, await callTool(tool, args, db, workspaceId));
		}

		default:
			return isNotification ? null : err(msg.id, -32601, `Method not found: ${msg.method}`);
	}
}

export default {
	async fetch(request: Request, env: Environment): Promise<Response> {
		if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

		const url = new URL(request.url);
		if (url.pathname !== '/mcp' && url.pathname !== '/') {
			return new Response('Not found', { status: 404, headers: CORS });
		}

		// Human-facing health page at the root only.
		if (request.method === 'GET' && url.pathname === '/') {
			return new Response('Junto MCP server — POST JSON-RPC to /mcp with a Bearer token.', {
				status: 200,
				headers: CORS
			});
		}
		// This server is stateless (no server→client SSE stream), so per the
		// Streamable HTTP spec a GET on the MCP endpoint is Method Not Allowed.
		if (request.method !== 'POST') {
			return new Response('Method not allowed', {
				status: 405,
				headers: { Allow: 'POST', ...CORS }
			});
		}

		// Bearer auth is the trust boundary for the whole server.
		const provided = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
		if (!tokenMatches(provided, env.MCP_BEARER_TOKEN)) {
			return new Response('Unauthorized', {
				status: 401,
				headers: { 'WWW-Authenticate': 'Bearer', ...CORS }
			});
		}

		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return json(err(null, -32700, 'Parse error'));
		}

		const db = createDb(env.DATABASE_URL);

		// JSON-RPC batch or single message.
		if (Array.isArray(body)) {
			const responses = (
				await Promise.all(body.map((m) => handleMessage(m as RpcRequest, db, env)))
			).filter((r): r is object => r !== null);
			return responses.length ? json(responses) : new Response(null, { status: 202, headers: CORS });
		}

		const response = await handleMessage(body as RpcRequest, db, env);
		return response ? json(response) : new Response(null, { status: 202, headers: CORS });
	},

	// Keep-alive (Phase 8): a trivial daily query so the free-tier Supabase
	// project doesn't pause after a week of inactivity. Cron in wrangler.jsonc.
	async scheduled(_event: ScheduledController, env: Environment, ctx: ExecutionContext) {
		ctx.waitUntil(
			(async () => {
				try {
					await pingDb(createDb(env.DATABASE_URL));
				} catch {
					/* best-effort keep-alive */
				}
			})()
		);
	}
} satisfies ExportedHandler<Environment>;
