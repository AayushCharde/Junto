/**
 * Task/project data access. Shared by the web app (Phase 1) and the MCP server
 * (Phase 6) so the two can never drift on how tasks are created or updated.
 *
 * All functions take a Drizzle `Database` and are scoped by workspace/id by the
 * caller. RLS is enforced from Phase 2; until then callers pass the seeded
 * default workspace.
 */

import { and, asc, eq } from 'drizzle-orm';
import type { CreateProjectInput, CreateTaskInput, UpdateTaskInput } from '@junto/core';
import type { Database } from './client';
import { profiles, projects, tasks, workspaces } from './schema';
import type { Project, Task, Workspace } from './schema';

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
