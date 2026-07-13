/**
 * Zod schemas for validating inputs at every boundary (SvelteKit endpoints now,
 * MCP tools in Phase 6). Shared so the web app and MCP server validate identically.
 */

import { z } from 'zod';
import { TASK_PRIORITIES, TASK_STATUSES } from './enums';

export const taskStatusSchema = z.enum(TASK_STATUSES);
export const taskPrioritySchema = z.enum(TASK_PRIORITIES);

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
	sortOrder: z.number().finite().optional()
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z
	.object({
		title: z.string().trim().min(1).max(500),
		description: z.string().max(10000).nullable(),
		status: taskStatusSchema,
		priority: taskPrioritySchema,
		sortOrder: z.number().finite()
	})
	.partial()
	.refine((patch) => Object.keys(patch).length > 0, {
		message: 'At least one field must be provided'
	});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
