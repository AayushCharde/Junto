// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Aayush Charde

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind class lists with conflict resolution (shadcn-svelte convention). */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
