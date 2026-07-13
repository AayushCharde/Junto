import type { TaskPriority, TaskStatus } from '@junto/core';

/** Tailwind text-color classes for each status dot (Linear-ish palette). */
export const STATUS_DOT: Record<TaskStatus, string> = {
	backlog: 'text-zinc-500',
	todo: 'text-zinc-300',
	in_progress: 'text-amber-400',
	done: 'text-emerald-400',
	canceled: 'text-zinc-600'
};

export const PRIORITY_DOT: Record<TaskPriority, string> = {
	none: 'text-zinc-600',
	low: 'text-sky-400',
	medium: 'text-yellow-400',
	high: 'text-orange-400',
	urgent: 'text-red-400'
};
