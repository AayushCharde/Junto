/**
 * Task/project data access. Shared by the web app (Phase 1) and the MCP server
 * (Phase 6) so the two can never drift on how tasks are created or updated.
 *
 * All functions take a Drizzle `Database` and are scoped by workspace/id by the
 * caller. RLS is enforced from Phase 2; until then callers pass the seeded
 * default workspace.
 */

import { and, asc, desc, eq } from 'drizzle-orm';
import type {
	ActivityAction,
	CreateCommentInput,
	CreateLabelInput,
	CreateProjectInput,
	CreateTaskInput,
	UpdateTaskInput
} from '@junto/core';
import type { Database } from './client';
import {
	activity,
	comments,
	labels,
	profiles,
	projects,
	taskLabels,
	tasks,
	workspaces
} from './schema';
import type { Label, Project, Task, Workspace } from './schema';

export interface TaskLabelLink {
	taskId: string;
	labelId: string;
}

/** A comment hydrated with its author's display name for the UI. */
export interface CommentWithAuthor {
	id: string;
	taskId: string;
	authorId: string;
	authorName: string | null;
	body: string;
	createdAt: Date;
}

/** An activity row hydrated with its actor's display name for the feed. */
export interface ActivityWithActor {
	id: string;
	workspaceId: string;
	actorId: string | null;
	actorName: string | null;
	entityType: string;
	entityId: string;
	action: string;
	meta: unknown;
	createdAt: Date;
}

export async function getDefaultWorkspace(db: Database): Promise<Workspace | null> {
	const [ws] = await db
		.select()
		.from(workspaces)
		.orderBy(asc(workspaces.createdAt))
		.limit(1);
	return ws ?? null;
}

/** The (oldest) workspace owned by a specific user. */
export async function getWorkspaceForUser(
	db: Database,
	userId: string
): Promise<Workspace | null> {
	const [ws] = await db
		.select()
		.from(workspaces)
		.where(eq(workspaces.ownerId, userId))
		.orderBy(asc(workspaces.createdAt))
		.limit(1);
	return ws ?? null;
}

/** Idempotently create the profile row for an auth user. */
export async function ensureProfile(
	db: Database,
	userId: string,
	displayName: string | null
): Promise<void> {
	await db
		.insert(profiles)
		.values({ id: userId, displayName })
		.onConflictDoNothing({ target: profiles.id });
}

/** Reassign every workspace owned by `fromUserId` to `toUserId`. Returns count. */
export async function reassignWorkspaces(
	db: Database,
	fromUserId: string,
	toUserId: string
): Promise<number> {
	const rows = await db
		.update(workspaces)
		.set({ ownerId: toUserId })
		.where(eq(workspaces.ownerId, fromUserId))
		.returning({ id: workspaces.id });
	return rows.length;
}

/** Fresh workspace + default Inbox project for a brand-new user. */
export async function createWorkspaceWithInbox(
	db: Database,
	userId: string,
	name = 'Personal'
): Promise<Workspace> {
	const [ws] = await db.insert(workspaces).values({ ownerId: userId, name }).returning();
	await db.insert(projects).values({ workspaceId: ws!.id, name: 'Inbox', color: '#6366f1' });
	return ws!;
}

/** Manual ownership scoping (Drizzle bypasses RLS). */
export async function userOwnsWorkspace(
	db: Database,
	userId: string,
	workspaceId: string
): Promise<boolean> {
	const [row] = await db
		.select({ id: workspaces.id })
		.from(workspaces)
		.where(and(eq(workspaces.id, workspaceId), eq(workspaces.ownerId, userId)))
		.limit(1);
	return Boolean(row);
}

export async function userOwnsProject(
	db: Database,
	userId: string,
	projectId: string
): Promise<boolean> {
	const [row] = await db
		.select({ id: projects.id })
		.from(projects)
		.innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
		.where(and(eq(projects.id, projectId), eq(workspaces.ownerId, userId)))
		.limit(1);
	return Boolean(row);
}

export async function userOwnsTask(
	db: Database,
	userId: string,
	taskId: string
): Promise<boolean> {
	const [row] = await db
		.select({ id: tasks.id })
		.from(tasks)
		.innerJoin(projects, eq(tasks.projectId, projects.id))
		.innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
		.where(and(eq(tasks.id, taskId), eq(workspaces.ownerId, userId)))
		.limit(1);
	return Boolean(row);
}

export async function listProjects(db: Database, workspaceId: string): Promise<Project[]> {
	return db
		.select()
		.from(projects)
		.where(eq(projects.workspaceId, workspaceId))
		.orderBy(asc(projects.createdAt));
}

export async function listTasksForWorkspace(
	db: Database,
	workspaceId: string
): Promise<Task[]> {
	const rows = await db
		.select()
		.from(tasks)
		.innerJoin(projects, eq(tasks.projectId, projects.id))
		.where(eq(projects.workspaceId, workspaceId))
		.orderBy(asc(tasks.sortOrder), asc(tasks.createdAt));
	return rows.map((r) => r.tasks);
}

export async function createProject(db: Database, input: CreateProjectInput): Promise<Project> {
	const [row] = await db
		.insert(projects)
		.values({
			id: input.id,
			workspaceId: input.workspaceId,
			name: input.name,
			color: input.color
		})
		.returning();
	return row!;
}

export async function createTask(db: Database, input: CreateTaskInput): Promise<Task> {
	const [row] = await db
		.insert(tasks)
		.values({
			id: input.id,
			projectId: input.projectId,
			title: input.title,
			description: input.description,
			status: input.status ?? 'backlog',
			priority: input.priority ?? 'none',
			dueDate: input.dueDate ?? null,
			parentTaskId: input.parentTaskId ?? null,
			// Monotonic default so new tasks land at the bottom of their column.
			sortOrder: input.sortOrder ?? Date.now()
		})
		.returning();
	return row!;
}

export async function updateTask(
	db: Database,
	id: string,
	patch: UpdateTaskInput
): Promise<Task | null> {
	const [row] = await db
		.update(tasks)
		.set({
			...(patch.title !== undefined ? { title: patch.title } : {}),
			...(patch.description !== undefined ? { description: patch.description } : {}),
			...(patch.status !== undefined ? { status: patch.status } : {}),
			...(patch.priority !== undefined ? { priority: patch.priority } : {}),
			...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}),
			...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
			updatedAt: new Date()
		})
		.where(eq(tasks.id, id))
		.returning();
	return row ?? null;
}

export async function deleteTask(db: Database, id: string): Promise<void> {
	await db.delete(tasks).where(eq(tasks.id, id));
}

// ── Labels ──────────────────────────────────────────────────────────────────

export async function listLabels(db: Database, workspaceId: string): Promise<Label[]> {
	return db
		.select()
		.from(labels)
		.where(eq(labels.workspaceId, workspaceId))
		.orderBy(asc(labels.name));
}

/** Every task→label link within a workspace (for hydrating the client). */
export async function listTaskLabels(
	db: Database,
	workspaceId: string
): Promise<TaskLabelLink[]> {
	return db
		.select({ taskId: taskLabels.taskId, labelId: taskLabels.labelId })
		.from(taskLabels)
		.innerJoin(tasks, eq(taskLabels.taskId, tasks.id))
		.innerJoin(projects, eq(tasks.projectId, projects.id))
		.where(eq(projects.workspaceId, workspaceId));
}

export async function createLabel(db: Database, input: CreateLabelInput): Promise<Label> {
	const [row] = await db
		.insert(labels)
		.values({
			id: input.id,
			workspaceId: input.workspaceId,
			name: input.name,
			color: input.color
		})
		.returning();
	return row!;
}

export async function deleteLabel(db: Database, id: string): Promise<void> {
	await db.delete(labels).where(eq(labels.id, id));
}

export async function addTaskLabel(db: Database, taskId: string, labelId: string): Promise<void> {
	await db.insert(taskLabels).values({ taskId, labelId }).onConflictDoNothing();
}

export async function removeTaskLabel(
	db: Database,
	taskId: string,
	labelId: string
): Promise<void> {
	await db
		.delete(taskLabels)
		.where(and(eq(taskLabels.taskId, taskId), eq(taskLabels.labelId, labelId)));
}

export async function userOwnsLabel(
	db: Database,
	userId: string,
	labelId: string
): Promise<boolean> {
	const [row] = await db
		.select({ id: labels.id })
		.from(labels)
		.innerJoin(workspaces, eq(labels.workspaceId, workspaces.id))
		.where(and(eq(labels.id, labelId), eq(workspaces.ownerId, userId)))
		.limit(1);
	return Boolean(row);
}

// ── Workspace resolvers (for scoping activity writes) ─────────────────────────

/** The workspace id a project belongs to, or null if it doesn't exist. */
export async function workspaceIdForProject(
	db: Database,
	projectId: string
): Promise<string | null> {
	const [row] = await db
		.select({ workspaceId: projects.workspaceId })
		.from(projects)
		.where(eq(projects.id, projectId))
		.limit(1);
	return row?.workspaceId ?? null;
}

/** The workspace id a task belongs to, or null if it doesn't exist. */
export async function workspaceIdForTask(db: Database, taskId: string): Promise<string | null> {
	const [row] = await db
		.select({ workspaceId: projects.workspaceId })
		.from(tasks)
		.innerJoin(projects, eq(tasks.projectId, projects.id))
		.where(eq(tasks.id, taskId))
		.limit(1);
	return row?.workspaceId ?? null;
}

// ── Comments ──────────────────────────────────────────────────────────────────

/** Every comment within a workspace (for hydrating the client), oldest first. */
export async function listCommentsForWorkspace(
	db: Database,
	workspaceId: string
): Promise<CommentWithAuthor[]> {
	return db
		.select({
			id: comments.id,
			taskId: comments.taskId,
			authorId: comments.authorId,
			authorName: profiles.displayName,
			body: comments.body,
			createdAt: comments.createdAt
		})
		.from(comments)
		.innerJoin(tasks, eq(comments.taskId, tasks.id))
		.innerJoin(projects, eq(tasks.projectId, projects.id))
		.leftJoin(profiles, eq(comments.authorId, profiles.id))
		.where(eq(projects.workspaceId, workspaceId))
		.orderBy(asc(comments.createdAt));
}

export async function createComment(
	db: Database,
	input: CreateCommentInput & { authorId: string }
): Promise<CommentWithAuthor> {
	const [row] = await db
		.insert(comments)
		.values({
			id: input.id,
			taskId: input.taskId,
			authorId: input.authorId,
			body: input.body
		})
		.returning();
	const [author] = await db
		.select({ displayName: profiles.displayName })
		.from(profiles)
		.where(eq(profiles.id, row!.authorId))
		.limit(1);
	return {
		id: row!.id,
		taskId: row!.taskId,
		authorId: row!.authorId,
		authorName: author?.displayName ?? null,
		body: row!.body,
		createdAt: row!.createdAt
	};
}

export async function deleteComment(db: Database, id: string): Promise<void> {
	await db.delete(comments).where(eq(comments.id, id));
}

/** A user may delete a comment if it lives in a workspace they own. */
export async function userOwnsComment(
	db: Database,
	userId: string,
	commentId: string
): Promise<boolean> {
	const [row] = await db
		.select({ id: comments.id })
		.from(comments)
		.innerJoin(tasks, eq(comments.taskId, tasks.id))
		.innerJoin(projects, eq(tasks.projectId, projects.id))
		.innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
		.where(and(eq(comments.id, commentId), eq(workspaces.ownerId, userId)))
		.limit(1);
	return Boolean(row);
}

// ── Activity (append-only) ────────────────────────────────────────────────────

export interface LogActivityInput {
	workspaceId: string;
	actorId: string | null;
	entityType: string;
	entityId: string;
	action: ActivityAction;
	meta?: unknown;
}

/**
 * Append one row to the audit feed. Best-effort: callers should not fail a
 * mutation because logging failed, so wrap calls in try/catch at the boundary.
 */
export async function logActivity(db: Database, input: LogActivityInput): Promise<void> {
	await db.insert(activity).values({
		workspaceId: input.workspaceId,
		actorId: input.actorId,
		entityType: input.entityType,
		entityId: input.entityId,
		action: input.action,
		meta: (input.meta ?? null) as never
	});
}

/** Recent activity for a workspace, newest first (capped). */
export async function listActivityForWorkspace(
	db: Database,
	workspaceId: string,
	limit = 100
): Promise<ActivityWithActor[]> {
	return db
		.select({
			id: activity.id,
			workspaceId: activity.workspaceId,
			actorId: activity.actorId,
			actorName: profiles.displayName,
			entityType: activity.entityType,
			entityId: activity.entityId,
			action: activity.action,
			meta: activity.meta,
			createdAt: activity.createdAt
		})
		.from(activity)
		.leftJoin(profiles, eq(activity.actorId, profiles.id))
		.where(eq(activity.workspaceId, workspaceId))
		.orderBy(desc(activity.createdAt))
		.limit(limit);
}
