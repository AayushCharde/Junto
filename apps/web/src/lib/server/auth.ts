import { env } from '$env/dynamic/private';
import type { User } from '@supabase/supabase-js';
import {
	createSupabaseAdmin,
	createWorkspaceWithInbox,
	ensureProfile,
	getWorkspaceForUser,
	reassignWorkspaces,
	type Database,
	type Workspace
} from '@junto/db';

/**
 * Runs on every authenticated request but does real work only on first login:
 *  1. ensure the user's profile row exists;
 *  2. if the user owns no workspace, claim the seeded default user's data
 *     (Phase 0/1 "Personal / Inbox") — the "migrate seeded data on first login"
 *     step — falling back to a fresh workspace if there's nothing to claim.
 */
export async function bootstrapUser(db: Database, user: User): Promise<Workspace> {
	await ensureProfile(db, user.id, user.email ?? null);

	const existing = await getWorkspaceForUser(db, user.id);
	if (existing) return existing;

	// Try to adopt the pre-auth seeded workspace(s).
	const seedEmail = env.DEFAULT_USER_EMAIL ?? 'you@junto.local';
	const supabaseUrl = env.SUPABASE_URL;
	const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

	if (supabaseUrl && serviceKey) {
		try {
			const admin = createSupabaseAdmin(supabaseUrl, serviceKey);
			const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
			const seedUser = data.users.find((u) => u.email === seedEmail);
			if (seedUser && seedUser.id !== user.id) {
				await reassignWorkspaces(db, seedUser.id, user.id);
			}
		} catch {
			// Non-fatal: fall through to creating a fresh workspace.
		}
	}

	const claimed = await getWorkspaceForUser(db, user.id);
	return claimed ?? (await createWorkspaceWithInbox(db, user.id));
}
