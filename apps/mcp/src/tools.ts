/**
 * Junto MCP tools. Each tool reuses the shared Zod schemas (@junto/core) and
 * data-access functions (@junto/db) so the MCP surface can never drift from the
 * web app. Every mutation is scoped to the single authorized workspace and
 * verifies the target project/task belongs to it — the bearer token is the
 * auth boundary, and Drizzle bypasses RLS, so this scoping is load-bearing.
 */

import {
	TASK_PRIORITIES,
	TASK_STATUSES,
	createProjectSchema,
	createTaskSchema,
	updateTaskSchema
} from '@junto/core';
import {
	createProject,
	createTask,
	listProjects,
	listTasksForWorkspace,
	logActivity,
	updateTask,
	workspaceIdForProject,
	workspaceIdForTask,
	type Database
} from '@junto/db';

export interface ToolContext {
	db: Database;
	workspaceId: string;
}

export interface ToolDef {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

/** Raised by a tool to signal a user-facing failure (mapped to isError content). */
export class ToolError extends Error {}

const statusEnum = { type: 'string', enum: [...TASK_STATUSES] };
const priorityEnum = { type: 'string', enum: [...TASK_PRIORITIES] };
const dateField = {
	type: 'string',
	description: 'Calendar date, YYYY-MM-DD',
	pattern: '^\\d{4}-\\d{2}-\\d{2}$'
};

export const TOOLS: ToolDef[] = [
	{
		name: 'list_projects',
		description: 'List all projects (boards) in the workspace — id, name, color, archived.',
		inputSchema: { type: 'object', properties: {}, additionalProperties: false },
		async run(_args, { db, workspaceId }) {
			const projects = await listProjects(db, workspaceId);
			return projects.map((p) => ({ id: p.id, name: p.name, color: p.color, archived: p.archived }));
		}
	},
	{
		name: 'list_tasks',
		description:
			'List tasks in the workspace. Optionally filter by project id and/or status. Returns top-level tasks and subtasks.',
		inputSchema: {
			type: 'object',
			properties: {
				projectId: { type: 'string', description: 'Only tasks in this project' },
				status: statusEnum
			},
			additionalProperties: false
		},
		async run(args, { db, workspaceId }) {
			let tasks = await listTasksForWorkspace(db, workspaceId);
			if (typeof args.projectId === 'string') {
				tasks = tasks.filter((t) => t.projectId === args.projectId);
			}
			if (typeof args.status === 'string') {
				tasks = tasks.filter((t) => t.status === args.status);
			}
			return tasks.map((t) => ({
				id: t.id,
				projectId: t.projectId,
				title: t.title,
				status: t.status,
				priority: t.priority,
				dueDate: t.dueDate,
				parentTaskId: t.parentTaskId
			}));
		}
	},
	{
		name: 'create_task',
		description:
			'Create a task in a project. Requires projectId (from list_projects) and title; status/priority/description/dueDate are optional.',
		inputSchema: {
			type: 'object',
			properties: {
				projectId: { type: 'string' },
				title: { type: 'string' },
				description: { type: 'string' },
				status: statusEnum,
				priority: priorityEnum,
				dueDate: dateField
			},
			required: ['projectId', 'title'],
			additionalProperties: false
		},
		async run(args, { db, workspaceId }) {
			const parsed = createTaskSchema.safeParse(args);
			if (!parsed.success) throw new ToolError(`Invalid input: ${parsed.error.message}`);
			if ((await workspaceIdForProject(db, parsed.data.projectId)) !== workspaceId) {
				throw new ToolError('Project not found in this workspace.');
			}
			const task = await createTask(db, parsed.data);
			await safeLog(db, workspaceId, task.id, 'created', { title: task.title });
			return task;
		}
	},
	{
		name: 'update_task',
		description:
			'Update a task by id. Provide taskId plus any of title, description, status, priority, dueDate.',
		inputSchema: {
			type: 'object',
			properties: {
				taskId: { type: 'string' },
				title: { type: 'string' },
				description: { type: ['string', 'null'] },
				status: statusEnum,
				priority: priorityEnum,
				dueDate: { ...dateField, type: ['string', 'null'] }
			},
			required: ['taskId'],
			additionalProperties: false
		},
		async run(args, { db, workspaceId }) {
			const taskId = args.taskId;
			if (typeof taskId !== 'string') throw new ToolError('taskId is required.');
			const { taskId: _omit, ...patch } = args;
			const parsed = updateTaskSchema.safeParse(patch);
			if (!parsed.success) throw new ToolError(`Invalid patch: ${parsed.error.message}`);
			if ((await workspaceIdForTask(db, taskId)) !== workspaceId) {
				throw new ToolError('Task not found in this workspace.');
			}
			const task = await updateTask(db, taskId, parsed.data);
			if (!task) throw new ToolError('Task not found.');
			const statusChanged = parsed.data.status !== undefined;
			await safeLog(db, workspaceId, task.id, statusChanged ? 'status_changed' : 'updated', {
				title: task.title,
				...(statusChanged ? { to: task.status } : {})
			});
			return task;
		}
	},
	{
		name: 'create_project',
		description: 'Create a new project (board) in the workspace. Requires a name; color is optional.',
		inputSchema: {
			type: 'object',
			properties: {
				name: { type: 'string' },
				color: { type: 'string', description: 'Hex color like #6366f1' }
			},
			required: ['name'],
			additionalProperties: false
		},
		async run(args, { db, workspaceId }) {
			const parsed = createProjectSchema.safeParse({ ...args, workspaceId });
			if (!parsed.success) throw new ToolError(`Invalid input: ${parsed.error.message}`);
			return createProject(db, parsed.data);
		}
	}
];

/** Best-effort activity log; never fail a tool because the audit write failed. */
async function safeLog(
	db: Database,
	workspaceId: string,
	entityId: string,
	action: 'created' | 'updated' | 'status_changed',
	meta: Record<string, unknown>
): Promise<void> {
	try {
		await logActivity(db, {
			workspaceId,
			actorId: null,
			entityType: 'task',
			entityId,
			action,
			meta: { ...meta, via: 'mcp' }
		});
	} catch {
		/* non-fatal */
	}
}
