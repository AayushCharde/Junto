// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Aayush Charde

import { getContext, setContext } from 'svelte';
import type { TaskStatus } from '@junto/core';

/**
 * App-wide UI state for the Phase 5 "speed layer": the ⌘K command palette, the
 * Huly-style task composer, the global task editor, and the shortcuts overlay.
 *
 * These live outside `TrackerStore` (which owns *data*) so any route — or the
 * command palette — can open a task, start a new one, or summon the palette
 * without threading local component state around. One instance is created in
 * the `(app)` layout and shared via context, exactly like the tracker store.
 */
export interface ComposerSeed {
	projectId?: string | null;
	status?: TaskStatus;
}

export class UiState {
	commandOpen = $state(false);
	shortcutsOpen = $state(false);
	/** Mobile off-canvas sidebar (below lg). Ignored on desktop. */
	sidebarOpen = $state(false);
	/** Task currently open in the editor (by id), or null. */
	editingTaskId = $state<string | null>(null);
	/** When set, the create-task composer is open, seeded with these defaults. */
	composer = $state<ComposerSeed | null>(null);

	toggleCommand() {
		this.commandOpen = !this.commandOpen;
	}

	closeCommand() {
		this.commandOpen = false;
	}

	toggleShortcuts() {
		this.shortcutsOpen = !this.shortcutsOpen;
	}

	toggleSidebar() {
		this.sidebarOpen = !this.sidebarOpen;
	}

	closeSidebar() {
		this.sidebarOpen = false;
	}

	openTask(id: string) {
		this.commandOpen = false;
		this.composer = null;
		this.editingTaskId = id;
	}

	closeTask() {
		this.editingTaskId = null;
	}

	/** Open the create-task composer, optionally seeded with a project/status. */
	newTask(seed: ComposerSeed = {}) {
		this.commandOpen = false;
		this.editingTaskId = null;
		this.composer = seed;
	}

	closeComposer() {
		this.composer = null;
	}
}

const UI_KEY = Symbol('ui');

export function setUi(state: UiState): UiState {
	return setContext(UI_KEY, state);
}

export function getUi(): UiState {
	return getContext<UiState>(UI_KEY);
}
