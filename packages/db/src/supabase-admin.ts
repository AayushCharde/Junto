// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Aayush Charde

/**
 * Service-role Supabase client factory. Bypasses RLS — use only in trusted
 * server contexts (seed script, and later the MCP Worker, which must manually
 * filter every query by user_id since the service role ignores RLS).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function createSupabaseAdmin(url: string, serviceRoleKey: string): SupabaseClient {
	return createClient(url, serviceRoleKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	});
}
