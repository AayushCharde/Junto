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

export interface Label {
	id: string;
	workspaceId: string;
	name: string;
	color: string | null;
}

export interface TaskLabelLink {
	taskId: string;
	labelId: string;
}

export interface Comment {
	id: string;
	taskId: string;
	authorId: string;
	authorName: string | null;
	body: string;
	createdAt: string;
}

export interface ActivityItem {
	id: string;
	actorId: string | null;
	actorName: string | null;
	entityType: string;
	entityId: string;
	action: string;
	meta: Record<string, unknown> | null;
	createdAt: string;
}

/**
 * Server-load DTO shapes for hydration. They differ from the client types only
 * in wire representation: timestamps arrive as `Date` (or string), `meta` as
 * `unknown`. The constructor normalizes them via `mapComment`/`mapActivity`.
 */
type CommentInput = Omit<Comment, 'createdAt'> & { createdAt: string | Date };
type ActivityInput = Omit<ActivityItem, 'meta' | 'createdAt'> & {
	meta: unknown;
	createdAt: string | Date;
};

export type View = 'board' | 'list';

export interface ProjectStats {
	total: number;
	active: number;
	done: number;
}

const ACTIVE: TaskStatus[] = ['todo', 'in_progress'];

function str(v: unknown): string {
	return String(v ?? '');
}

function mapTask(raw: Record<string, unknown>): Task {
	return {
		id: str(raw.id),
		projectId: str(raw.projectId ?? raw.project_id),
		title: str(raw.title),
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
		id: str(raw.id),
		workspaceId: str(raw.workspaceId ?? raw.workspace_id),
		name: str(raw.name),
		color: (raw.color as string | null) ?? null,
		archived: Boolean(raw.archived)
	};
}

function mapLabel(raw: Record<string, unknown>): Label {
	return {
		id: str(raw.id),
		workspaceId: str(raw.workspaceId ?? raw.workspace_id),
		name: str(raw.name),
		color: (raw.color as string | null) ?? null
	};
}

function mapLink(raw: Record<string, unknown>): TaskLabelLink {
	return {
		taskId: str(raw.taskId ?? raw.task_id),
		labelId: str(raw.labelId ?? raw.label_id)
	};
}

function ts(v: unknown): string {
	if (v instanceof Date) return v.toISOString();
	return str(v);
}

function mapComment(raw: Record<string, unknown>): Comment {
	return {
		id: str(raw.id),
		taskId: str(raw.taskId ?? raw.task_id),
		authorId: str(raw.authorId ?? raw.author_id),
		authorName: (raw.authorName as string | null) ?? null,
		body: str(raw.body),
		createdAt: ts(raw.createdAt ?? raw.created_at)
	};
}

function mapActivity(raw: Record<string, unknown>): ActivityItem {
	const meta = raw.meta;
	return {
		id: str(raw.id),
		actorId: (raw.actorId as string | null) ?? (raw.actor_id as string | null) ?? null,
		actorName: (raw.actorName as string | null) ?? null,
		entityType: str(raw.entityType ?? raw.entity_type),
		entityId: str(raw.entityId ?? raw.entity_id),
		action: str(raw.action),
		meta: (meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : null),
		createdAt: ts(raw.createdAt ?? raw.created_at)
	};
}

export class TrackerStore {
	projects = $state<Project[]>([]);
	tasks = $state<Task[]>([]);
	labels = $state<Label[]>([]);
	taskLabels = $state<TaskLabelLink[]>([]);
	comments = $state<Comment[]>([]);
	activity = $state<ActivityItem[]>([]);
	view = $state<View>('board');

	// Filters (project-view scoped, session-only).
	filterPriority = $state<TaskPriority | null>(null);
	filterLabelId = $state<string | null>(null);

	readonly workspaceId: string | null;
	readonly workspaceName: string;
	readonly currentUserId: string | null;
	readonly currentUserName: string | null;
	#supabase: SupabaseClient | null = null;
	#channel: RealtimeChannel | null = null;

	constructor(init: {
		workspaceId: string | null;
		workspaceName?: string;
		currentUserId?: string | null;
		currentUserName?: string | null;
		projects: Project[];
		tasks: Task[];
		labels?: Label[];
		taskLabels?: TaskLabelLink[];
		comments?: CommentInput[];
		activity?: ActivityInput[];
	}) {
		this.workspaceId = init.workspaceId;
		this.workspaceName = init.workspaceName ?? 'Workspace';
		this.currentUserId = init.currentUserId ?? null;
		this.currentUserName = init.currentUserName ?? null;
		this.projects = init.projects.map((p) => mapProject(p as unknown as Record<string, unknown>));
		this.tasks = init.tasks.map((t) => mapTask(t as unknown as Record<string, unknown>));
		this.labels = (init.labels ?? []).map((l) => mapLabel(l as unknown as Record<string, unknown>));
		this.taskLabels = (init.taskLabels ?? []).map((l) =>
			mapLink(l as unknown as Record<string, unknown>)
		);
		this.comments = (init.comments ?? []).map((c) =>
			mapComment(c as unknown as Record<string, unknown>)
		);
		this.activity = (init.activity ?? []).map((a) =>
			mapActivity(a as unknown as Record<string, unknown>)
		);
	}

	// ── Selectors ────────────────────────────────────────────────────────────

	projectById(id: string): Project | null {
		return this.projects.find((p) => p.id === id) ?? null;
	}

	get hasActiveFilters(): boolean {
		return this.filterPriority !== null || this.filterLabelId !== null;
	}

	#matchesFilters(t: Task): boolean {
		if (this.filterPriority && t.priority !== this.filterPriority) return false;
		if (this.filterLabelId && !this.taskHasLabel(t.id, this.filterLabelId)) return false;
		return true;
	}

	/** Top-level (non-subtask) tasks for a project, after filters, sorted. */
	tasksForProject(projectId: string): Task[] {
		return this.tasks
			.filter((t) => t.projectId === projectId && t.parentTaskId === null && this.#matchesFilters(t))
			.sort((a, b) => a.sortOrder - b.sortOrder);
	}

	tasksByStatus(projectId: string, status: TaskStatus): Task[] {
		return this.tasksForProject(projectId).filter((t) => t.status === status);
	}

	countByStatus(projectId: string, status: TaskStatus): number {
		return this.tasksByStatus(projectId, status).length;
	}

	subtasksOf(parentId: string): Task[] {
		return this.tasks
			.filter((t) => t.parentTaskId === parentId)
			.sort((a, b) => a.sortOrder - b.sortOrder);
	}

	subtaskProgress(parentId: string): { done: number; total: number } {
		const subs = this.tasks.filter((t) => t.parentTaskId === parentId);
		return { done: subs.filter((t) => t.status === 'done').length, total: subs.length };
	}

	taskHasLabel(taskId: string, labelId: string): boolean {
		return this.taskLabels.some((l) => l.taskId === taskId && l.labelId === labelId);
	}

	labelsForTask(taskId: string): Label[] {
		const ids = new Set(this.taskLabels.filter((l) => l.taskId === taskId).map((l) => l.labelId));
		return this.labels.filter((l) => ids.has(l.id));
	}

	/** Comments on a task, oldest first. */
	commentsForTask(taskId: string): Comment[] {
		return this.comments
			.filter((c) => c.taskId === taskId)
			.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
	}

	commentCount(taskId: string): number {
		return this.comments.reduce((n, c) => (c.taskId === taskId ? n + 1 : n), 0);
	}

	/** Activity for a single task (its own events), newest first. */
	activityForTask(taskId: string): ActivityItem[] {
		return this.activity
			.filter((a) => a.entityType === 'task' && a.entityId === taskId)
			.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	}

	/** Workspace-wide feed, newest first (for the Home dashboard). */
	get recentActivity(): ActivityItem[] {
		return [...this.activity].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
	}

	projectStats(projectId: string): ProjectStats {
		const ts = this.tasks.filter((t) => t.projectId === projectId && t.parentTaskId === null);
		return {
			total: ts.length,
			active: ts.filter((t) => ACTIVE.includes(t.status)).length,
			done: ts.filter((t) => t.status === 'done').length
		};
	}

	// ── Dashboard aggregates (root tasks across all projects) ────────────────

	get #rootTasks(): Task[] {
		return this.tasks.filter((t) => t.parentTaskId === null);
	}

	get totalTasks(): number {
		return this.#rootTasks.length;
	}

	get activeTasks(): Task[] {
		return this.#rootTasks
			.filter((t) => ACTIVE.includes(t.status))
			.sort(
				(a, b) =>
					TASK_PRIORITY_ORDER.indexOf(a.priority) - TASK_PRIORITY_ORDER.indexOf(b.priority)
			);
	}

	statusCount(status: TaskStatus): number {
		return this.#rootTasks.filter((t) => t.status === status).length;
	}

	get doneCount(): number {
		return this.statusCount('done');
	}

	setView(view: View) {
		this.view = view;
	}

	setFilterPriority(p: TaskPriority | null) {
		this.filterPriority = p;
	}

	setFilterLabel(id: string | null) {
		this.filterLabelId = id;
	}

	clearFilters() {
		this.filterPriority = null;
		this.filterLabelId = null;
	}

	// ── Task mutations (optimistic) ──────────────────────────────────────────

	async #postTask(optimistic: Task, body: Record<string, unknown>): Promise<void> {
		this.tasks.push(optimistic);
		try {
			const res = await fetch('/api/tasks', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!res.ok) throw new Error('create task failed');
			this.#upsertTask(mapTask(await res.json()));
		} catch {
			this.tasks = this.tasks.filter((t) => t.id !== optimistic.id);
		}
	}

	createTask(projectId: string, title: string, status: TaskStatus = 'backlog'): Promise<void> {
		const trimmed = title.trim();
		if (!projectId || !trimmed) return Promise.resolve();
		const id = crypto.randomUUID();
		const sortOrder = Date.now();
		return this.#postTask(
			{
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
			},
			{ id, projectId, title: trimmed, status, sortOrder }
		);
	}

	/**
	 * Create a task with full metadata in one go (the Huly-style composer).
	 * Posts the task, then applies any labels once the row exists server-side.
	 * Returns the new task id, or null on failure.
	 */
	async createDetailedTask(input: {
		projectId: string;
		title: string;
		description?: string | null;
		status?: TaskStatus;
		priority?: TaskPriority;
		dueDate?: string | null;
		labelIds?: string[];
	}): Promise<string | null> {
		const title = input.title.trim();
		if (!input.projectId || !title) return null;
		const id = crypto.randomUUID();
		const sortOrder = Date.now();
		const status = input.status ?? 'backlog';
		const priority = input.priority ?? 'none';
		const description = input.description?.trim() ? input.description.trim() : null;
		const dueDate = input.dueDate || null;

		const optimistic: Task = {
			id,
			projectId: input.projectId,
			title,
			description,
			status,
			priority,
			assigneeId: null,
			dueDate,
			parentTaskId: null,
			sortOrder
		};
		this.tasks.push(optimistic);
		try {
			const res = await fetch('/api/tasks', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ id, projectId: input.projectId, title, description, status, priority, dueDate, sortOrder })
			});
			if (!res.ok) throw new Error('create task failed');
			this.#upsertTask(mapTask(await res.json()));
		} catch {
			this.tasks = this.tasks.filter((t) => t.id !== id);
			return null;
		}
		// Apply labels after the task exists (each is its own optimistic call).
		for (const labelId of input.labelIds ?? []) {
			void this.toggleTaskLabel(id, labelId);
		}
		return id;
	}

	createSubtask(parentTaskId: string, projectId: string, title: string): Promise<void> {
		const trimmed = title.trim();
		if (!trimmed) return Promise.resolve();
		const id = crypto.randomUUID();
		const sortOrder = Date.now();
		return this.#postTask(
			{
				id,
				projectId,
				title: trimmed,
				description: null,
				status: 'backlog',
				priority: 'none',
				assigneeId: null,
				dueDate: null,
				parentTaskId,
				sortOrder
			},
			{ id, projectId, title: trimmed, parentTaskId, sortOrder }
		);
	}

	async updateTask(
		id: string,
		patch: Partial<
			Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'dueDate' | 'sortOrder'>
		>
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

	async moveTask(id: string, status: TaskStatus, sortOrder = Date.now()): Promise<void> {
		await this.updateTask(id, { status, sortOrder });
	}

	toggleSubtaskDone(id: string, done: boolean): Promise<void> {
		return this.updateTask(id, { status: done ? 'done' : 'todo' });
	}

	async deleteTask(id: string): Promise<void> {
		const prevTasks = this.tasks;
		const prevLinks = this.taskLabels;
		const prevComments = this.comments;
		// Remove the task, its subtasks, and any label links + comments.
		const subIds = new Set(this.tasks.filter((t) => t.parentTaskId === id).map((t) => t.id));
		this.tasks = this.tasks.filter((t) => t.id !== id && t.parentTaskId !== id);
		this.taskLabels = this.taskLabels.filter((l) => l.taskId !== id && !subIds.has(l.taskId));
		this.comments = this.comments.filter((c) => c.taskId !== id && !subIds.has(c.taskId));
		try {
			const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
			if (!res.ok && res.status !== 204) throw new Error('delete task failed');
		} catch {
			this.tasks = prevTasks;
			this.taskLabels = prevLinks;
			this.comments = prevComments;
		}
	}

	// ── Project + label mutations ────────────────────────────────────────────

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

	async createLabel(name: string, color: string | null = null): Promise<string | null> {
		const trimmed = name.trim();
		if (!this.workspaceId || !trimmed) return null;
		const id = crypto.randomUUID();
		this.labels.push({ id, workspaceId: this.workspaceId, name: trimmed, color });
		try {
			const res = await fetch('/api/labels', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ id, workspaceId: this.workspaceId, name: trimmed, color })
			});
			if (!res.ok) throw new Error('create label failed');
			this.#upsertLabel(mapLabel(await res.json()));
			return id;
		} catch {
			this.labels = this.labels.filter((l) => l.id !== id);
			return null;
		}
	}

	async deleteLabel(id: string): Promise<void> {
		const prevLabels = this.labels;
		const prevLinks = this.taskLabels;
		this.labels = this.labels.filter((l) => l.id !== id);
		this.taskLabels = this.taskLabels.filter((l) => l.labelId !== id);
		if (this.filterLabelId === id) this.filterLabelId = null;
		try {
			const res = await fetch(`/api/labels/${id}`, { method: 'DELETE' });
			if (!res.ok && res.status !== 204) throw new Error('delete label failed');
		} catch {
			this.labels = prevLabels;
			this.taskLabels = prevLinks;
		}
	}

	async toggleTaskLabel(taskId: string, labelId: string): Promise<void> {
		const has = this.taskHasLabel(taskId, labelId);
		const prev = this.taskLabels;
		if (has) {
			this.taskLabels = this.taskLabels.filter(
				(l) => !(l.taskId === taskId && l.labelId === labelId)
			);
		} else {
			this.taskLabels.push({ taskId, labelId });
		}
		try {
			const res = has
				? await fetch(`/api/tasks/${taskId}/labels/${labelId}`, { method: 'DELETE' })
				: await fetch(`/api/tasks/${taskId}/labels`, {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ labelId })
					});
			if (!res.ok && res.status !== 204) throw new Error('toggle label failed');
		} catch {
			this.taskLabels = prev;
		}
	}

	// ── Comment mutations (optimistic) ───────────────────────────────────────

	async addComment(taskId: string, body: string): Promise<void> {
		const trimmed = body.trim();
		if (!taskId || !trimmed) return;
		const id = crypto.randomUUID();
		const optimistic: Comment = {
			id,
			taskId,
			authorId: this.currentUserId ?? '',
			authorName: this.currentUserName,
			body: trimmed,
			// Sortable ISO timestamp; reconciled with the server's on success.
			createdAt: new Date().toISOString()
		};
		this.comments.push(optimistic);
		try {
			const res = await fetch(`/api/tasks/${taskId}/comments`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ id, taskId, body: trimmed })
			});
			if (!res.ok) throw new Error('create comment failed');
			this.#upsertComment(mapComment(await res.json()));
		} catch {
			this.comments = this.comments.filter((c) => c.id !== id);
		}
	}

	async deleteComment(id: string): Promise<void> {
		const prev = this.comments;
		this.comments = this.comments.filter((c) => c.id !== id);
		try {
			const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' });
			if (!res.ok && res.status !== 204) throw new Error('delete comment failed');
		} catch {
			this.comments = prev;
		}
	}

	// ── Realtime ─────────────────────────────────────────────────────────────

	startRealtime(): void {
		if (this.#channel) return;
		const supabase = createSupabaseBrowserClient();
		this.#supabase = supabase;
		this.#channel = supabase
			.channel('tracker')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (p) => {
				if (p.eventType === 'DELETE') this.#removeTask(str((p.old as Record<string, unknown>).id));
				else this.#upsertTask(mapTask(p.new as Record<string, unknown>));
			})
			.on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, (p) => {
				if (p.eventType === 'DELETE')
					this.#removeProject(str((p.old as Record<string, unknown>).id));
				else this.#upsertProject(mapProject(p.new as Record<string, unknown>));
			})
			.on('postgres_changes', { event: '*', schema: 'public', table: 'labels' }, (p) => {
				if (p.eventType === 'DELETE')
					this.#removeLabel(str((p.old as Record<string, unknown>).id));
				else this.#upsertLabel(mapLabel(p.new as Record<string, unknown>));
			})
			.on('postgres_changes', { event: '*', schema: 'public', table: 'task_labels' }, (p) => {
				if (p.eventType === 'DELETE') this.#removeLink(mapLink(p.old as Record<string, unknown>));
				else this.#addLink(mapLink(p.new as Record<string, unknown>));
			})
			.on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, (p) => {
				if (p.eventType === 'DELETE')
					this.#removeComment(str((p.old as Record<string, unknown>).id));
				else this.#upsertComment(mapComment(p.new as Record<string, unknown>));
			})
			.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity' }, (p) => {
				this.#addActivity(mapActivity(p.new as Record<string, unknown>));
			})
			.subscribe();
	}

	stopRealtime(): void {
		if (this.#channel && this.#supabase) this.#supabase.removeChannel(this.#channel);
		this.#channel = null;
		this.#supabase = null;
	}

	// ── Reconciliation helpers ───────────────────────────────────────────────

	#upsertTask(task: Task): void {
		const idx = this.tasks.findIndex((t) => t.id === task.id);
		if (idx === -1) this.tasks.push(task);
		else this.tasks[idx] = task;
	}

	#removeTask(id: string): void {
		this.tasks = this.tasks.filter((t) => t.id !== id && t.parentTaskId !== id);
		this.taskLabels = this.taskLabels.filter((l) => l.taskId !== id);
		this.comments = this.comments.filter((c) => c.taskId !== id);
	}

	#upsertProject(project: Project): void {
		const idx = this.projects.findIndex((p) => p.id === project.id);
		if (idx === -1) this.projects.push(project);
		else this.projects[idx] = project;
	}

	#removeProject(id: string): void {
		this.projects = this.projects.filter((p) => p.id !== id);
	}

	#upsertLabel(label: Label): void {
		const idx = this.labels.findIndex((l) => l.id === label.id);
		if (idx === -1) this.labels.push(label);
		else this.labels[idx] = label;
	}

	#removeLabel(id: string): void {
		this.labels = this.labels.filter((l) => l.id !== id);
		this.taskLabels = this.taskLabels.filter((l) => l.labelId !== id);
	}

	#addLink(link: TaskLabelLink): void {
		if (!this.taskHasLabel(link.taskId, link.labelId)) this.taskLabels.push(link);
	}

	#removeLink(link: TaskLabelLink): void {
		this.taskLabels = this.taskLabels.filter(
			(l) => !(l.taskId === link.taskId && l.labelId === link.labelId)
		);
	}

	#resolveActorName(id: string | null, given: string | null): string | null {
		// Realtime payloads carry no joined profile name; fill the current user's.
		if (given) return given;
		if (id && id === this.currentUserId) return this.currentUserName;
		return null;
	}

	#upsertComment(comment: Comment): void {
		const resolved = { ...comment, authorName: this.#resolveActorName(comment.authorId, comment.authorName) };
		const idx = this.comments.findIndex((c) => c.id === resolved.id);
		if (idx === -1) this.comments.push(resolved);
		else this.comments[idx] = resolved;
	}

	#removeComment(id: string): void {
		this.comments = this.comments.filter((c) => c.id !== id);
	}

	#addActivity(item: ActivityItem): void {
		if (this.activity.some((a) => a.id === item.id)) return;
		this.activity.push({ ...item, actorName: this.#resolveActorName(item.actorId, item.actorName) });
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
