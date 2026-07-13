import type { TaskPriority, TaskStatus } from '@junto/core';

/** Canonical status colors (hex) — used by the status icon and the distribution bar. */
export const STATUS_COLOR: Record<TaskStatus, string> = {
	backlog: '#8b8b94',
	todo: '#a1a1aa',
	in_progress: '#f59e0b',
	done: '#10b981',
	canceled: '#6b6b73'
};

/** Priority colors (hex) — used by the priority bar icon. */
export const PRIORITY_COLOR: Record<TaskPriority, string> = {
	none: '#71717a',
	low: '#38bdf8',
	medium: '#eab308',
	high: '#f97316',
	urgent: '#f43f5e'
};
