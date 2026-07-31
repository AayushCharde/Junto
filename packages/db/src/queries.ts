/**
 * Task/project data access. Shared by the web app (Phase 1) and the MCP server
 * (Phase 6) so the two can never drift on how tasks are created or updated.
 *
 * All functions take a Drizzle `Database` and are scoped by workspace/id by the
 * caller. RLS is enforced from Phase 2; until then callers pass the seeded
 * default workspace.
 */

import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { toVectorLiteral } from '@junto/core';
import type {
	ActivityAction,
	CreateCommentInput,
	CreateLabelInput,
	CreateProjectInput,
	CreateTaskInput,
	UpdateLabelInput,
	UpdateProjectInput,
	UpdateTaskInput,
	UpdateWorkspaceInput
} from '@junto/core';
import type { Database } from './client';
import {
	activity,
	comments,
	embeddings,
	labels,
	profiles,
	projects,
	taskLabels,
	tasks,
	workspaceInvites,
	workspaceMembers,
	workspaces
} from './schema';
import type { Label, Profile, Project, Task, Workspace, WorkspaceInvite } from './schema';

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

/** Trivial round-trip to keep a paused-on-idle database warm (Phase 8 cron). */
export async function pingDb(db: Database): Promise<void> {
	await db.execute(sql`select 1`);
}

export async function getDefaultWorkspace(db: Database): Promise<Workspace | null> {
	const [ws] = await db
		.select()
		.from(workspaces)
		.orderBy(asc(workspaces.createdAt))
		.limit(1);
	return ws ?? null;
}

/** The (oldest) workspace the user is a member of. */
export async function getWorkspaceForUser(
	db: Database,
	userId: string
): Promise<Workspace | null> {
	const [ws] = await db
		.select({
			id: workspaces.id,
			ownerId: workspaces.ownerId,
			name: workspaces.name,
			createdAt: workspaces.createdAt
		})
		.from(workspaces)
		.innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
		.where(eq(workspaceMembers.userId, userId))
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

export async function getProfile(db: Database, userId: string): Promise<Profile | null> {
	const [row] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
	return row ?? null;
}

/** Set the user's display name (used for assignee "name tags" and the feed). */
export async function updateProfileName(
	db: Database,
	userId: string,
	displayName: string | null
): Promise<Profile | null> {
	const [row] = await db
		.insert(profiles)
		.values({ id: userId, displayName })
		.onConflictDoUpdate({ target: profiles.id, set: { displayName } })
		.returning();
	return row ?? null;
}

export async function updateWorkspace(
	db: Database,
	id: string,
	patch: UpdateWorkspaceInput
): Promise<Workspace | null> {
	const [row] = await db
		.update(workspaces)
		.set({ name: patch.name })
		.where(eq(workspaces.id, id))
		.returning();
	return row ?? null;
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

/** Fresh workspace + default Inbox project + owner membership for a new user. */
export async function createWorkspaceWithInbox(
	db: Database,
	userId: string,
	name = 'Personal'
): Promise<Workspace> {
	const [ws] = await db.insert(workspaces).values({ ownerId: userId, name }).returning();
	await db.insert(projects).values({ workspaceId: ws!.id, name: 'Inbox', color: '#6366f1' });
	await db
		.insert(workspaceMembers)
		.values({ workspaceId: ws!.id, userId, role: 'owner' })
		.onConflictDoNothing();
	return ws!;
}

/**
 * Ensure the owner of a workspace has an owner-membership row. Idempotent;
 * used by `bootstrapUser` so pre-membership owners (or newly reassigned seed
 * workspaces) get a membership without a data migration.
 */
export async function ensureOwnerMembership(db: Database, userId: string): Promise<void> {
	const owned = await db
		.select({ id: workspaces.id })
		.from(workspaces)
		.where(eq(workspaces.ownerId, userId));
	if (owned.length === 0) return;
	await db
		.insert(workspaceMembers)
		.values(owned.map((w) => ({ workspaceId: w.id, userId, role: 'owner' })))
		.onConflictDoNothing();
}

/**
 * Manual access scoping (Drizzle bypasses RLS). As of Phase 2 these check
 * *membership* — a user may touch a workspace's data if they belong to it.
 * The `userOwns*` names are kept for continuity; semantics = "is a member".
 */
export async function isWorkspaceMember(
	db: Database,
	userId: string,
	workspaceId: string
): Promise<boolean> {
	const [row] = await db
		.select({ userId: workspaceMembers.userId })
		.from(workspaceMembers)
		.where(
			and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId))
		)
		.limit(1);
	return Boolean(row);
}

/** Workspace-management gate (invites, members, rename): owner only. */
export async function isWorkspaceOwner(
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

export async function userOwnsWorkspace(
	db: Database,
	userId: string,
	workspaceId: string
): Promise<boolean> {
	return isWorkspaceMember(db, userId, workspaceId);
}

export async function userOwnsProject(
	db: Database,
	userId: string,
	projectId: string
): Promise<boolean> {
	const [row] = await db
		.select({ id: projects.id })
		.from(projects)
		.innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, projects.workspaceId))
		.where(and(eq(projects.id, projectId), eq(workspaceMembers.userId, userId)))
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
		.innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, projects.workspaceId))
		.where(and(eq(tasks.id, taskId), eq(workspaceMembers.userId, userId)))
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

/** Short display key from a project name: first 3 alphanumerics, uppercased. */
export function deriveProjectKey(name: string): string {
	return name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'PRJ';
}

export async function createProject(db: Database, input: CreateProjectInput): Promise<Project> {
	const [row] = await db
		.insert(projects)
		.values({
			id: input.id,
			workspaceId: input.workspaceId,
			name: input.name,
			color: input.color,
			key: deriveProjectKey(input.name),
			issueCounter: 0
		})
		.returning();
	return row!;
}

export async function updateProject(
	db: Database,
	id: string,
	patch: UpdateProjectInput
): Promise<Project | null> {
	const [row] = await db
		.update(projects)
		.set({
			...(patch.name !== undefined ? { name: patch.name } : {}),
			...(patch.color !== undefined ? { color: patch.color } : {}),
			...(patch.archived !== undefined ? { archived: patch.archived } : {})
		})
		.where(eq(projects.id, id))
		.returning();
	return row ?? null;
}

/** Deletes a project; its tasks/labels-links cascade via FK. */
export async function deleteProject(db: Database, id: string): Promise<void> {
	await db.delete(projects).where(eq(projects.id, id));
}

export async function createTask(
	db: Database,
	input: CreateTaskInput,
	createdBy: string | null = null
): Promise<Task> {
	// Atomically claim the next per-project issue number.
	const [proj] = await db
		.update(projects)
		.set({ issueCounter: sql`${projects.issueCounter} + 1` })
		.where(eq(projects.id, input.projectId))
		.returning({ n: projects.issueCounter });

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
			assigneeId: input.assigneeId ?? null,
			parentTaskId: input.parentTaskId ?? null,
			number: proj?.n ?? null,
			createdBy,
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
			...(patch.assigneeId !== undefined ? { assigneeId: patch.assigneeId } : {}),
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

export async function updateLabel(
	db: Database,
	id: string,
	patch: UpdateLabelInput
): Promise<Label | null> {
	const [row] = await db
		.update(labels)
		.set({
			...(patch.name !== undefined ? { name: patch.name } : {}),
			...(patch.color !== undefined ? { color: patch.color } : {})
		})
		.where(eq(labels.id, id))
		.returning();
	return row ?? null;
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
		.innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, labels.workspaceId))
		.where(and(eq(labels.id, labelId), eq(workspaceMembers.userId, userId)))
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

/** A user may delete a comment if it lives in a workspace they belong to. */
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
		.innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, projects.workspaceId))
		.where(and(eq(comments.id, commentId), eq(workspaceMembers.userId, userId)))
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

// ── Members & invites (Phase 2) ─────────────────────────────────────────────

/** A workspace member hydrated with their display name for the UI. */
export interface MemberWithProfile {
	userId: string;
	role: string;
	name: string | null;
	isOwner: boolean;
	createdAt: Date;
}

/** All members of a workspace, owner first then by join time. */
export async function listMembers(
	db: Database,
	workspaceId: string
): Promise<MemberWithProfile[]> {
	const rows = await db
		.select({
			userId: workspaceMembers.userId,
			role: workspaceMembers.role,
			name: profiles.displayName,
			ownerId: workspaces.ownerId,
			createdAt: workspaceMembers.createdAt
		})
		.from(workspaceMembers)
		.innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
		.leftJoin(profiles, eq(workspaceMembers.userId, profiles.id))
		.where(eq(workspaceMembers.workspaceId, workspaceId))
		.orderBy(asc(workspaceMembers.createdAt));
	return rows.map((r) => ({
		userId: r.userId,
		role: r.role,
		name: r.name,
		isOwner: r.userId === r.ownerId,
		createdAt: r.createdAt
	}));
}

/** Remove a member. The workspace owner can never be removed. */
export async function removeMember(
	db: Database,
	workspaceId: string,
	userId: string
): Promise<void> {
	const [ws] = await db
		.select({ ownerId: workspaces.ownerId })
		.from(workspaces)
		.where(eq(workspaces.id, workspaceId))
		.limit(1);
	if (ws && ws.ownerId === userId) return; // never orphan the workspace
	await db
		.delete(workspaceMembers)
		.where(
			and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId))
		);
}

/** Create a shareable invite. Returns the row (its `token` builds the URL). */
export async function createInvite(
	db: Database,
	workspaceId: string,
	role: string,
	createdBy: string,
	expiresAt: Date | null = null
): Promise<WorkspaceInvite> {
	const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
	const [row] = await db
		.insert(workspaceInvites)
		.values({ workspaceId, role, token, createdBy, expiresAt })
		.returning();
	return row!;
}

/** Pending (unexpired, unrevoked) invites for a workspace, newest first. */
export async function listInvites(
	db: Database,
	workspaceId: string
): Promise<WorkspaceInvite[]> {
	return db
		.select()
		.from(workspaceInvites)
		.where(eq(workspaceInvites.workspaceId, workspaceId))
		.orderBy(desc(workspaceInvites.createdAt));
}

/** Delete (revoke) an invite. Returns the workspace it belonged to, for auth. */
export async function getInviteById(
	db: Database,
	id: string
): Promise<WorkspaceInvite | null> {
	const [row] = await db
		.select()
		.from(workspaceInvites)
		.where(eq(workspaceInvites.id, id))
		.limit(1);
	return row ?? null;
}

export async function revokeInvite(db: Database, id: string): Promise<void> {
	await db.delete(workspaceInvites).where(eq(workspaceInvites.id, id));
}

export type AcceptInviteResult =
	| { ok: true; workspaceId: string; alreadyMember: boolean }
	| { ok: false; reason: 'not_found' | 'expired' };

/**
 * Accept a shareable invite by token: adds the user as a member of the invite's
 * workspace. Shareable links are reusable until expired or revoked (deleted).
 * Idempotent — re-accepting is a no-op success.
 */
export async function acceptInvite(
	db: Database,
	token: string,
	userId: string
): Promise<AcceptInviteResult> {
	const [invite] = await db
		.select()
		.from(workspaceInvites)
		.where(eq(workspaceInvites.token, token))
		.limit(1);
	if (!invite) return { ok: false, reason: 'not_found' };
	if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
		return { ok: false, reason: 'expired' };
	}

	const already = await isWorkspaceMember(db, userId, invite.workspaceId);
	if (!already) {
		await db
			.insert(workspaceMembers)
			.values({ workspaceId: invite.workspaceId, userId, role: invite.role })
			.onConflictDoNothing();
		// Record first use for the owner's reference (informational only).
		await db
			.update(workspaceInvites)
			.set({ acceptedAt: new Date() })
			.where(and(eq(workspaceInvites.id, invite.id), isNull(workspaceInvites.acceptedAt)));
	}
	return { ok: true, workspaceId: invite.workspaceId, alreadyMember: already };
}

// ── Search (Phase 7) ──────────────────────────────────────────────────────────

/**
 * Full-text search over a workspace's tasks, ranked. Queries the STORED
 * `search_vector` generated column (see migration 0005) via raw SQL —
 * `websearch_to_tsquery` gives Google-ish syntax (quotes, OR, -exclude).
 */
export async function searchTasks(
	db: Database,
	workspaceId: string,
	query: string,
	limit = 20
): Promise<Task[]> {
	const rows = await db
		.select()
		.from(tasks)
		.innerJoin(projects, eq(tasks.projectId, projects.id))
		.where(
			and(
				eq(projects.workspaceId, workspaceId),
				sql`tasks.search_vector @@ websearch_to_tsquery('english', ${query})`
			)
		)
		.orderBy(sql`ts_rank(tasks.search_vector, websearch_to_tsquery('english', ${query})) DESC`)
		.limit(limit);
	return rows.map((r) => r.tasks);
}

/**
 * Semantic (vector) search over a workspace's tasks using a query embedding and
 * cosine distance (`<=>`, matching the HNSW index). The caller supplies the
 * query vector (embedded via Ollama); this stays pure SQL so it has no AI dep.
 */
export async function semanticSearchTasks(
	db: Database,
	workspaceId: string,
	queryEmbedding: number[],
	limit = 20
): Promise<Task[]> {
	const literal = toVectorLiteral(queryEmbedding);
	const rows = await db
		.select()
		.from(tasks)
		.innerJoin(
			embeddings,
			and(eq(embeddings.entityId, tasks.id), eq(embeddings.entityType, 'task'))
		)
		.innerJoin(projects, eq(tasks.projectId, projects.id))
		.where(eq(projects.workspaceId, workspaceId))
		.orderBy(sql`${embeddings.embedding} <=> ${literal}::vector`)
		.limit(limit);
	return rows.map((r) => r.tasks);
}

/** All tasks (id/title/description) for the embedding backfill script. */
export async function listTasksForEmbedding(
	db: Database
): Promise<{ id: string; title: string; description: string | null }[]> {
	return db
		.select({ id: tasks.id, title: tasks.title, description: tasks.description })
		.from(tasks);
}

/** Upsert one entity's embedding (keyed by entity_type + entity_id). */
export async function upsertEmbedding(
	db: Database,
	entityType: string,
	entityId: string,
	content: string,
	embedding: number[]
): Promise<void> {
	await db
		.insert(embeddings)
		.values({ entityType, entityId, content, embedding })
		.onConflictDoUpdate({
			target: [embeddings.entityType, embeddings.entityId],
			set: { content, embedding }
		});
}
