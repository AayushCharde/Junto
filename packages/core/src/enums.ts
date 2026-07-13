/**
 * Shared domain enums used by the database schema, the web app, and the MCP
 * server. Keeping these in one place means the UI, the API, and the MCP tools
 * can never drift on what a valid status or priority is.
 */

export const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'done', 'canceled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** Human-friendly labels for rendering in the UI. */
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
	backlog: 'Backlog',
	todo: 'Todo',
	in_progress: 'In Progress',
	done: 'Done',
	canceled: 'Canceled'
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
	none: 'No priority',
	low: 'Low',
	medium: 'Medium',
	high: 'High',
	urgent: 'Urgent'
};

/** Stable ordering for boards/pickers (kanban columns, priority sort). */
export const TASK_STATUS_ORDER: TaskStatus[] = [...TASK_STATUSES];
export const TASK_PRIORITY_ORDER: TaskPriority[] = ['urgent', 'high', 'medium', 'low', 'none'];

export function isTaskStatus(value: unknown): value is TaskStatus {
	return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}

export function isTaskPriority(value: unknown): value is TaskPriority {
	return typeof value === 'string' && (TASK_PRIORITIES as readonly string[]).includes(value);
}
