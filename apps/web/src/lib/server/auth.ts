import { env } from '$env/dynamic/private';
import type { User } from '@supabase/supabase-js';
import {
	acceptInvite,
	createSupabaseAdmin,
	createWorkspaceWithInbox,
	ensureOwnerMembership,
	ensureProfile,
	getWorkspaceForUser,
	reassignWorkspaces,
	type Database,
	type Workspace
} from '@junto/db';

/**
 * Runs on every authenticated request but does real work only on first login:
 *  1. ensure the user's profile row exists;
 *  2. if a pending invite token was captured (logged-out user clicked an invite
 *     link, was bounced to /login), redeem it now so they join that workspace;
 *  3. ensure the user has an owner-membership for any workspace they own
 *     (covers seed adoption + pre-Phase-2 owners);
 *  4. resolve the user's (oldest) workspace by MEMBERSHIP — if none, claim the
 *     seeded default user's data, else create a fresh Personal/Inbox workspace.
 *
 * Returns the resolved workspace plus any invite-redemption outcome so the
 * caller (layout load) can surface a message and clear the cookie.
 */
export async function bootstrapUser(
	db: Database,
	user: User,
	inviteToken?: string | null
): Promise<Workspace> {
	await ensureProfile(db, user.id, user.email ?? null);

	// Redeem a pending invite captured before login (best-effort).
	if (inviteToken) {
		try {
			await acceptInvite(db, inviteToken, user.id);
		} catch {
			// Non-fatal: fall through to normal resolution.
		}
	}

	// Backstop: an owner should always be a member of what they own.
	await ensureOwnerMembership(db, user.id);

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
				await ensureOwnerMembership(db, user.id);
			}
		} catch {
			// Non-fatal: fall through to creating a fresh workspace.
		}
	}

	const claimed = await getWorkspaceForUser(db, user.id);
	return claimed ?? (await createWorkspaceWithInbox(db, user.id));
}
