import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { TASK_STATUS_ORDER, type TaskPriority, type TaskStatus } from '@junto/core';
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

export class TrackerStore {
	projects = $state<Project[]>([]);
	tasks = $state<Task[]>([]);
	currentProjectId = $state<string | null>(null);
	view = $state<View>('board');

	readonly workspaceId: string | null;
	#supabase: SupabaseClient | null = null;
	#channel: RealtimeChannel | null = null;

	constructor(init: {
		workspaceId: string | null;
		projects: Project[];
		tasks: Task[];
	}) {
		this.workspaceId = init.workspaceId;
		this.projects = init.projects.map((p) => mapProject(p as unknown as Record<string, unknown>));
		this.tasks = init.tasks.map((t) => mapTask(t as unknown as Record<string, unknown>));
		this.currentProjectId = this.projects[0]?.id ?? null;
	}

	get currentProject(): Project | null {
		return this.projects.find((p) => p.id === this.currentProjectId) ?? null;
	}

	get visibleTasks(): Task[] {
		return this.tasks.filter((t) => t.projectId === this.currentProjectId);
	}

	tasksByStatus(status: TaskStatus): Task[] {
		return this.visibleTasks
			.filter((t) => t.status === status)
			.sort((a, b) => a.sortOrder - b.sortOrder);
	}

	countByStatus(status: TaskStatus): number {
		return this.visibleTasks.filter((t) => t.status === status).length;
	}

	selectProject(id: string) {
		this.currentProjectId = id;
	}

	setView(view: View) {
		this.view = view;
	}

	// ── Mutations (optimistic, reconciled against the server) ────────────────

	async createProject(name: string): Promise<void> {
		if (!this.workspaceId) return;
		const id = crypto.randomUUID();
		const optimistic: Project = {
			id,
			workspaceId: this.workspaceId,
			name,
			color: null,
			archived: false
		};
		this.projects.push(optimistic);
		this.currentProjectId = id;
		try {
			const res = await fetch('/api/projects', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ id, workspaceId: this.workspaceId, name })
			});
			if (!res.ok) throw new Error('create project failed');
			this.#upsertProject(mapProject(await res.json()));
		} catch {
			this.projects = this.projects.filter((p) => p.id !== id);
			if (this.currentProjectId === id) this.currentProjectId = this.projects[0]?.id ?? null;
		}
	}

	async createTask(title: string, status: TaskStatus = 'backlog'): Promise<void> {
		const projectId = this.currentProjectId;
		const trimmed = title.trim();
		if (!projectId || !trimmed) return;
		const id = crypto.randomUUID();
		const sortOrder = Date.now();
		const optimistic: Task = {
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
		};
		this.tasks.push(optimistic);
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
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'tasks' },
				(payload) => {
					if (payload.eventType === 'DELETE') {
						this.#removeTask(String((payload.old as Record<string, unknown>).id));
					} else {
						this.#upsertTask(mapTask(payload.new as Record<string, unknown>));
					}
				}
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'projects' },
				(payload) => {
					if (payload.eventType === 'DELETE') {
						this.#removeProject(String((payload.old as Record<string, unknown>).id));
					} else {
						this.#upsertProject(mapProject(payload.new as Record<string, unknown>));
					}
				}
			)
			.subscribe();
	}

	stopRealtime(): void {
		if (this.#channel && this.#supabase) {
			this.#supabase.removeChannel(this.#channel);
		}
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
		if (this.currentProjectId === id) this.currentProjectId = this.projects[0]?.id ?? null;
	}
}

export const STATUS_COLUMNS = TASK_STATUS_ORDER;
