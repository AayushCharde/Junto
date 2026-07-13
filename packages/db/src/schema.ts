/**
 * Junto database schema (Drizzle ORM, Supabase Postgres).
 *
 * Multi-tenancy is ownership-based: every row ultimately belongs to a workspace,
 * and a workspace is owned by exactly one `auth.users` row. Access control is
 * enforced with Postgres Row-Level Security — the policies live in `src/rls.sql`
 * and are applied in Phase 2 (auth). Until then the app runs against the
 * seeded default workspace + user via a direct Drizzle connection.
 */

import {
	boolean,
	date,
	doublePrecision,
	foreignKey,
	index,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
	vector
} from 'drizzle-orm/pg-core';
import { authUsers } from 'drizzle-orm/supabase';
import { TASK_PRIORITIES, TASK_STATUSES } from '@junto/core';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const taskStatus = pgEnum('task_status', TASK_STATUSES);
export const taskPriority = pgEnum('task_priority', TASK_PRIORITIES);

const createdAt = timestamp('created_at', { withTimezone: true }).defaultNow().notNull();

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/** One row per auth user; public-facing profile data. */
export const profiles = pgTable('profiles', {
	id: uuid('id')
		.primaryKey()
		.references(() => authUsers.id, { onDelete: 'cascade' }),
	displayName: text('display_name'),
	avatarUrl: text('avatar_url'),
	createdAt
});

export const workspaces = pgTable(
	'workspaces',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		ownerId: uuid('owner_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		createdAt
	},
	(t) => [index('workspaces_owner_id_idx').on(t.ownerId)]
);

export const projects = pgTable(
	'projects',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		workspaceId: uuid('workspace_id')
			.notNull()
			.references(() => workspaces.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		color: text('color'),
		archived: boolean('archived').notNull().default(false),
		createdAt
	},
	(t) => [index('projects_workspace_id_idx').on(t.workspaceId)]
);

export const tasks = pgTable(
	'tasks',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		projectId: uuid('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		description: text('description'),
		status: taskStatus('status').notNull().default('backlog'),
		priority: taskPriority('priority').notNull().default('none'),
		assigneeId: uuid('assignee_id').references(() => authUsers.id, { onDelete: 'set null' }),
		dueDate: date('due_date'),
		// Self-referential FK for subtasks (constraint defined in the table extras below).
		parentTaskId: uuid('parent_task_id'),
		// Fractional ordering so drag-to-reorder (Phase 3) never needs a full renumber.
		sortOrder: doublePrecision('sort_order').notNull().default(0),
		createdAt,
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date())
	},
	(t) => [
		foreignKey({
			columns: [t.parentTaskId],
			foreignColumns: [t.id],
			name: 'tasks_parent_task_id_fk'
		}).onDelete('cascade'),
		index('tasks_project_id_idx').on(t.projectId),
		index('tasks_status_idx').on(t.status),
		index('tasks_parent_task_id_idx').on(t.parentTaskId),
		index('tasks_assignee_id_idx').on(t.assigneeId)
	]
);

export const labels = pgTable(
	'labels',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		workspaceId: uuid('workspace_id')
			.notNull()
			.references(() => workspaces.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		color: text('color')
	},
	(t) => [index('labels_workspace_id_idx').on(t.workspaceId)]
);

export const taskLabels = pgTable(
	'task_labels',
	{
		taskId: uuid('task_id')
			.notNull()
			.references(() => tasks.id, { onDelete: 'cascade' }),
		labelId: uuid('label_id')
			.notNull()
			.references(() => labels.id, { onDelete: 'cascade' })
	},
	(t) => [
		primaryKey({ columns: [t.taskId, t.labelId] }),
		index('task_labels_label_id_idx').on(t.labelId)
	]
);

export const comments = pgTable(
	'comments',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		taskId: uuid('task_id')
			.notNull()
			.references(() => tasks.id, { onDelete: 'cascade' }),
		authorId: uuid('author_id')
			.notNull()
			.references(() => authUsers.id, { onDelete: 'cascade' }),
		body: text('body').notNull(),
		createdAt
	},
	(t) => [index('comments_task_id_idx').on(t.taskId)]
);

/** Append-only audit log. */
export const activity = pgTable(
	'activity',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		workspaceId: uuid('workspace_id')
			.notNull()
			.references(() => workspaces.id, { onDelete: 'cascade' }),
		actorId: uuid('actor_id').references(() => authUsers.id, { onDelete: 'set null' }),
		entityType: text('entity_type').notNull(),
		entityId: uuid('entity_id').notNull(),
		action: text('action').notNull(),
		meta: jsonb('meta'),
		createdAt
	},
	(t) => [
		index('activity_workspace_id_idx').on(t.workspaceId),
		index('activity_entity_idx').on(t.entityType, t.entityId)
	]
);

/**
 * Dormant until the AI phase (Phase 7). Requires the `vector` extension.
 * Dimension is 768 to match a typical local Ollama embedding model
 * (e.g. `nomic-embed-text`); revisit if the model changes.
 */
export const embeddings = pgTable(
	'embeddings',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		entityType: text('entity_type').notNull(),
		entityId: uuid('entity_id').notNull(),
		content: text('content').notNull(),
		embedding: vector('embedding', { dimensions: 768 })
	},
	(t) => [index('embeddings_entity_idx').on(t.entityType, t.entityId)]
);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Label = typeof labels.$inferSelect;
export type NewLabel = typeof labels.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type Activity = typeof activity.$inferSelect;
export type NewActivity = typeof activity.$inferInsert;
export type Embedding = typeof embeddings.$inferSelect;
export type NewEmbedding = typeof embeddings.$inferInsert;
