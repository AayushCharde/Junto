/**
 * Zod schemas for validating inputs at every boundary (SvelteKit endpoints now,
 * MCP tools in Phase 6). Shared so the web app and MCP server validate identically.
 */

import { z } from 'zod';
import { TASK_PRIORITIES, TASK_STATUSES } from './enums';

export const taskStatusSchema = z.enum(TASK_STATUSES);
export const taskPrioritySchema = z.enum(TASK_PRIORITIES);

/** Calendar date, YYYY-MM-DD. */
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const createProjectSchema = z.object({
	// Client may supply the id so optimistic UI + Realtime reconcile cleanly.
	id: z.string().uuid().optional(),
	workspaceId: z.string().uuid(),
	name: z.string().trim().min(1).max(120),
	color: z.string().trim().max(32).optional()
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const createTaskSchema = z.object({
	id: z.string().uuid().optional(),
	projectId: z.string().uuid(),
	title: z.string().trim().min(1).max(500),
	description: z.string().max(10000).optional(),
	status: taskStatusSchema.optional(),
	priority: taskPrioritySchema.optional(),
	dueDate: dateSchema.nullable().optional(),
	parentTaskId: z.string().uuid().nullable().optional(),
	sortOrder: z.number().finite().optional()
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z
	.object({
		title: z.string().trim().min(1).max(500),
		description: z.string().max(10000).nullable(),
		status: taskStatusSchema,
		priority: taskPrioritySchema,
		dueDate: dateSchema.nullable(),
		sortOrder: z.number().finite()
	})
	.partial()
	.refine((patch) => Object.keys(patch).length > 0, {
		message: 'At least one field must be provided'
	});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const createLabelSchema = z.object({
	id: z.string().uuid().optional(),
	workspaceId: z.string().uuid(),
	name: z.string().trim().min(1).max(60),
	color: z.string().trim().max(32).optional()
});
export type CreateLabelInput = z.infer<typeof createLabelSchema>;

export const taskLabelSchema = z.object({
	labelId: z.string().uuid()
});
export type TaskLabelInput = z.infer<typeof taskLabelSchema>;

/**
 * A comment on a task. `authorId` is never taken from the client — the server
 * fills it from the authenticated session. The client may supply `id` so
 * optimistic UI + Realtime reconcile by id, like tasks and labels.
 */
export const createCommentSchema = z.object({
	id: z.string().uuid().optional(),
	taskId: z.string().uuid(),
	body: z.string().trim().min(1).max(10000)
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
