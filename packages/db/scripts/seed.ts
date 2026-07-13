/**
 * Seeds one default user + workspace + project so the tracker is usable in the
 * pre-auth phases (Phase 0/1). Idempotent: safe to run repeatedly.
 *
 * In Phase 2, first login will re-attribute this seeded data to the real user.
 * Run with: pnpm db:seed
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { createDb } from '../src/client';
import { createSupabaseAdmin } from '../src/supabase-admin';
import { profiles, projects, workspaces } from '../src/schema';

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const DATABASE_URL = process.env.DATABASE_URL;
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_USER_EMAIL = process.env.DEFAULT_USER_EMAIL ?? 'you@junto.local';

if (!DATABASE_URL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
	console.error(
		'Seed requires DATABASE_URL, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY in the repo-root .env file.'
	);
	process.exit(1);
}

const supabase = createSupabaseAdmin(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const db = createDb(DATABASE_URL);

async function findOrCreateDefaultUser(): Promise<string> {
	// Look for an existing user with the default email.
	const { data: list, error: listError } = await supabase.auth.admin.listUsers({
		page: 1,
		perPage: 200
	});
	if (listError) throw listError;

	const existing = list.users.find((u) => u.email === DEFAULT_USER_EMAIL);
	if (existing) {
		console.log(`Using existing default user ${DEFAULT_USER_EMAIL} (${existing.id})`);
		return existing.id;
	}

	const { data: created, error: createError } = await supabase.auth.admin.createUser({
		email: DEFAULT_USER_EMAIL,
		email_confirm: true
	});
	if (createError) throw createError;
	if (!created.user) throw new Error('Failed to create default user');

	console.log(`Created default user ${DEFAULT_USER_EMAIL} (${created.user.id})`);
	return created.user.id;
}

async function main() {
	const userId = await findOrCreateDefaultUser();

	// Profile (id -> auth.users.id).
	await db
		.insert(profiles)
		.values({ id: userId, displayName: 'You' })
		.onConflictDoNothing({ target: profiles.id });

	// Default workspace (one per owner for the seed).
	const existingWorkspaces = await db
		.select()
		.from(workspaces)
		.where(eq(workspaces.ownerId, userId));

	let workspaceId = existingWorkspaces[0]?.id;
	if (!workspaceId) {
		const [ws] = await db
			.insert(workspaces)
			.values({ ownerId: userId, name: 'Personal' })
			.returning();
		workspaceId = ws!.id;
		console.log(`Created workspace "Personal" (${workspaceId})`);
	} else {
		console.log(`Using existing workspace (${workspaceId})`);
	}

	// Default project.
	const existingProjects = await db
		.select()
		.from(projects)
		.where(eq(projects.workspaceId, workspaceId));

	if (existingProjects.length === 0) {
		const [proj] = await db
			.insert(projects)
			.values({ workspaceId, name: 'Inbox', color: '#6366f1' })
			.returning();
		console.log(`Created project "Inbox" (${proj!.id})`);
	} else {
		console.log(`Workspace already has ${existingProjects.length} project(s); skipping.`);
	}

	console.log('\nSeed complete.');
	console.log(`  Default user:  ${DEFAULT_USER_EMAIL} (${userId})`);
	console.log(`  Workspace id:  ${workspaceId}`);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error('Seed failed:', err);
		process.exit(1);
	});
