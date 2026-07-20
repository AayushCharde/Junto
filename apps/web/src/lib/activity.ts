/** Formatting helpers for the comments + activity feed (Phase 4). */

import { TASK_STATUS_LABELS, isTaskStatus, type ActivityAction } from '@junto/core';
import type { ActivityItem } from '$lib/state/tracker.svelte';

/** Compact relative time from an ISO timestamp, e.g. "just now", "3h", "2d". */
export function formatRelative(iso: string): string {
	const then = new Date(iso).getTime();
	if (Number.isNaN(then)) return '';
	const secs = Math.round((Date.now() - then) / 1000);
	if (secs < 45) return 'just now';
	const mins = Math.round(secs / 60);
	if (mins < 60) return `${mins}m`;
	const hrs = Math.round(mins / 60);
	if (hrs < 24) return `${hrs}h`;
	const days = Math.round(hrs / 24);
	if (days < 7) return `${days}d`;
	return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const ACTION_VERB: Record<ActivityAction, string> = {
	created: 'created this task',
	status_changed: 'changed status',
	updated: 'updated this task',
	deleted: 'deleted this task',
	commented: 'commented'
};

/** Human sentence for one activity row (subject-less; the actor is rendered separately). */
export function describeActivity(item: ActivityItem): string {
	const base = ACTION_VERB[item.action as ActivityAction] ?? item.action;
	if (item.action === 'status_changed') {
		const to = item.meta?.to;
		if (typeof to === 'string' && isTaskStatus(to)) {
			return `moved to ${TASK_STATUS_LABELS[to]}`;
		}
	}
	return base;
}
