import { getContext, setContext } from 'svelte';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import {
	TASK_PRIORITY_ORDER,
	TASK_STATUS_ORDER,
	type TaskPriority,
	type TaskStatus
} from '@junto/core';
import { createSupabaseBrowserClient } from '$lib/supabase/client';

export interface Project {
	id: string;
	workspaceId: string;
	name: string;
	color: string | null;
	archived: boolean;
}

export interface Task {
	id: string;
	projectId: string;
	title: string;
	description: string | null;
	status: TaskStatus;
	priority: TaskPriority;
	assigneeId: string | null;
	dueDate: string | null;
	parentTaskId: string | null;
	sortOrder: number;
}

export type View = 'board' | 'list';

export interface ProjectStats {
	total: number;
	active: number;
	done: number;
}

/** Normalize a row from either the JSON API (camelCase) or Realtime (snake_case). */
function mapTask(raw: Record<string, unknown>): Task {
	return {
		id: String(raw.id),
		projectId: String(raw.projectId ?? raw.project_id),
		title: String(raw.title ?? ''),
		description: (raw.description as string | null) ?? null,
		status: (raw.status as TaskStatus) ?? 'backlog',
		priority: (raw.priority as TaskPriority) ?? 'none',
		assigneeId: (raw.assigneeId as string | null) ?? (raw.assignee_id as string | null) ?? null,
		dueDate: (raw.dueDate as string | null) ?? (raw.due_date as string | null) ?? null,
		parentTaskId:
			(raw.parentTaskId as string | null) ?? (raw.parent_task_id as string | null) ?? null,
		sortOrder: Number(raw.sortOrder ?? raw.sort_order ?? 0)
	};
}

function mapProject(raw: Record<string, unknown>): Project {
	return {
		id: String(raw.id),
		workspaceId: String(raw.workspaceId ?? raw.workspace_id),
		name: String(raw.name ?? ''),
		color: (raw.color as string | null) ?? null,
		archived: Boolean(raw.archived)
	};
}

const ACTIVE: TaskStatus[] = ['todo', 'in_progress'];

export class TrackerStore {
	projects = $state<Project[]>([]);
	tasks = $state<Task[]>([]);
	view = $state<View>('board');

	readonly workspaceId: string | null;
	readonly workspaceName: string;
	#supabase: SupabaseClient | null = null;
	#channel: RealtimeChannel | null = null;

	constructor(init: {
		workspaceId: string | null;
		workspaceName?: string;
		projects: Project[];
		tasks: Task[];
	}) {
		this.workspaceId = init.workspaceId;
		this.workspaceName = init.workspaceName ?? 'Workspace';
		this.projects = init.projects.map((p) => mapProject(p as unknown as Record<string, unknown>));
		this.tasks = init.tasks.map((t) => mapTask(t as unknown as Record<string, unknown>));
	}

	// ── Selectors ────────────────────────────────────────────────────────────

	projectById(id: string): Project | null {
		return this.projects.find((p) => p.id === id) ?? null;
	}

	tasksForProject(projectId: string): Task[] {
		return this.tasks
			.filter((t) => t.projectId === projectId)
			.sort((a, b) => a.sortOrder - b.sortOrder);
	}

	tasksByStatus(projectId: string, status: TaskStatus): Task[] {
		return this.tasksForProject(projectId).filter((t) => t.status === status);
	}

	countByStatus(projectId: string, status: TaskStatus): number {
		return this.tasks.filter((t) => t.projectId === projectId && t.status === status).length;
	}

	projectStats(projectId: string): ProjectStats {
		const ts = this.tasks.filter((t) => t.projectId === projectId);
		return {
			total: ts.length,
			active: ts.filter((t) => ACTIVE.includes(t.status)).length,
			done: ts.filter((t) => t.status === 'done').length
		};
	}

	// ── Dashboard aggregates (across all projects) ───────────────────────────

	get totalTasks(): number {
		return this.tasks.length;
	}

	get activeTasks(): Task[] {
		return this.tasks
			.filter((t) => ACTIVE.includes(t.status))
			.sort(
				(a, b) =>
					TASK_PRIORITY_ORDER.indexOf(a.priority) - TASK_PRIORITY_ORDER.indexOf(b.priority)
			);
	}

	statusCount(status: TaskStatus): number {
		return this.tasks.filter((t) => t.status === status).length;
	}

	get doneCount(): number {
		return this.statusCount('done');
	}

	setView(view: View) {
		this.view = view;
	}

	// ── Mutations (optimistic, reconciled against the server) ────────────────

	async createProject(name: string): Promise<string | null> {
		if (!this.workspaceId) return null;
		const id = crypto.randomUUID();
		this.projects.push({ id, workspaceId: this.workspaceId, name, color: null, archived: false });
		try {
			const res = await fetch('/api/projects', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ id, workspaceId: this.workspaceId, name })
			});
			if (!res.ok) throw new Error('create project failed');
			this.#upsertProject(mapProject(await res.json()));
			return id;
		} catch {
			this.projects = this.projects.filter((p) => p.id !== id);
			return null;
		}
	}

	async createTask(projectId: string, title: string, status: TaskStatus = 'backlog'): Promise<void> {
		const trimmed = title.trim();
		if (!projectId || !trimmed) return;
		const id = crypto.randomUUID();
		const sortOrder = Date.now();
		this.tasks.push({
			id,
			projectId,
			title: trimmed,
			description: null,
			status,
			priority: 'none',
			assigneeId: null,
			dueDate: null,
			parentTaskId: null,
			sortOrder
		});
		try {
			const res = await fetch('/api/tasks', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ id, projectId, title: trimmed, status, sortOrder })
			});
			if (!res.ok) throw new Error('create task failed');
			this.#upsertTask(mapTask(await res.json()));
		} catch {
			this.tasks = this.tasks.filter((t) => t.id !== id);
		}
	}

	async updateTask(
		id: string,
		patch: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'sortOrder'>>
	): Promise<void> {
		const idx = this.tasks.findIndex((t) => t.id === id);
		if (idx === -1) return;
		const prev = this.tasks[idx];
		this.tasks[idx] = { ...prev, ...patch };
		try {
			const res = await fetch(`/api/tasks/${id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(patch)
			});
			if (!res.ok) throw new Error('update task failed');
			this.#upsertTask(mapTask(await res.json()));
		} catch {
			const i = this.tasks.findIndex((t) => t.id === id);
			if (i !== -1) this.tasks[i] = prev;
		}
	}

	/** Move a task to a different status column, placing it at the bottom. */
	async moveTask(id: string, status: TaskStatus): Promise<void> {
		await this.updateTask(id, { status, sortOrder: Date.now() });
	}

	async deleteTask(id: string): Promise<void> {
		const prev = this.tasks;
		this.tasks = this.tasks.filter((t) => t.id !== id);
		try {
			const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
			if (!res.ok && res.status !== 204) throw new Error('delete task failed');
		} catch {
			this.tasks = prev;
		}
	}

	// ── Realtime ─────────────────────────────────────────────────────────────

	startRealtime(): void {
		if (this.#channel) return;
		const supabase = createSupabaseBrowserClient();
		this.#supabase = supabase;
		this.#channel = supabase
			.channel('tracker')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
				if (payload.eventType === 'DELETE') {
					this.#removeTask(String((payload.old as Record<string, unknown>).id));
				} else {
					this.#upsertTask(mapTask(payload.new as Record<string, unknown>));
				}
			})
			.on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (payload) => {
				if (payload.eventType === 'DELETE') {
					this.#removeProject(String((payload.old as Record<string, unknown>).id));
				} else {
					this.#upsertProject(mapProject(payload.new as Record<string, unknown>));
				}
			})
			.subscribe();
	}

	stopRealtime(): void {
		if (this.#channel && this.#supabase) this.#supabase.removeChannel(this.#channel);
		this.#channel = null;
		this.#supabase = null;
	}

	// ── Internal reconciliation helpers ──────────────────────────────────────

	#upsertTask(task: Task): void {
		const idx = this.tasks.findIndex((t) => t.id === task.id);
		if (idx === -1) this.tasks.push(task);
		else this.tasks[idx] = task;
	}

	#removeTask(id: string): void {
		this.tasks = this.tasks.filter((t) => t.id !== id);
	}

	#upsertProject(project: Project): void {
		const idx = this.projects.findIndex((p) => p.id === project.id);
		if (idx === -1) this.projects.push(project);
		else this.projects[idx] = project;
	}

	#removeProject(id: string): void {
		this.projects = this.projects.filter((p) => p.id !== id);
	}
}

export const STATUS_COLUMNS = TASK_STATUS_ORDER;

// ── Context plumbing so every route shares one store instance ───────────────
const TRACKER_KEY = Symbol('tracker');

export function setTracker(store: TrackerStore): TrackerStore {
	return setContext(TRACKER_KEY, store);
}

export function getTracker(): TrackerStore {
	return getContext<TrackerStore>(TRACKER_KEY);
}
