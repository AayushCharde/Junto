<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import CommandPalette from '$lib/components/command-palette.svelte';
	import TaskComposer from '$lib/components/task-composer.svelte';
	import TaskEditor from '$lib/components/task-editor.svelte';
	import ShortcutsHelp from '$lib/components/shortcuts-help.svelte';
	import { setTracker, TrackerStore } from '$lib/state/tracker.svelte';
	import { setUi, UiState } from '$lib/state/ui.svelte';

	let { data, children } = $props();

	const store = setTracker(
		new TrackerStore({
			workspaceId: data.workspace?.id ?? null,
			workspaceName: data.workspace?.name ?? 'Workspace',
			currentUserId: data.user?.id ?? null,
			currentUserName: data.user?.email ?? null,
			projects: data.projects,
			tasks: data.tasks,
			labels: data.labels,
			taskLabels: data.taskLabels,
			comments: data.comments,
			activity: data.activity
		})
	);

	const ui = setUi(new UiState());

	// The editor is driven by shared UI state so the palette (or any route) can
	// open a task from anywhere. Deriving from the store keeps it live.
	const editingTask = $derived(
		ui.editingTaskId ? (store.tasks.find((t) => t.id === ui.editingTaskId) ?? null) : null
	);

	onMount(() => {
		store.startRealtime();
		return () => store.stopRealtime();
	});

	function isTyping(target: EventTarget | null): boolean {
		const el = target as HTMLElement | null;
		if (!el) return false;
		const tag = el.tagName;
		return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
	}

	const anyModalOpen = $derived(
		ui.commandOpen || ui.shortcutsOpen || ui.composer !== null || ui.editingTaskId !== null
	);

	// `g` chord state (e.g. "g h" → Home). Reset shortly after the first key.
	let awaitingG = false;
	let gTimer: ReturnType<typeof setTimeout> | undefined;

	function onWindowKeydown(e: KeyboardEvent) {
		// ⌘K / Ctrl+K always toggles the palette, even from inside a field.
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			ui.toggleCommand();
			return;
		}
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		// Single-key shortcuts: only when not typing and no modal is open.
		if (isTyping(e.target) || anyModalOpen) return;

		if (awaitingG) {
			awaitingG = false;
			clearTimeout(gTimer);
			if (e.key === 'h') {
				e.preventDefault();
				goto('/');
				return;
			}
		}

		switch (e.key) {
			case 'g':
				awaitingG = true;
				gTimer = setTimeout(() => (awaitingG = false), 800);
				break;
			case 'c':
				e.preventDefault();
				ui.newTask({ projectId: page.params.projectId ?? null });
				break;
			case 'b':
				store.setView('board');
				break;
			case 'l':
				store.setView('list');
				break;
			case '?':
				e.preventDefault();
				ui.toggleShortcuts();
				break;
		}
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div class="flex h-screen overflow-hidden">
	<AppSidebar userEmail={data.user?.email ?? null} />
	<div class="flex min-w-0 flex-1 flex-col">
		{@render children()}
	</div>
</div>

<CommandPalette />
<TaskComposer />
<TaskEditor task={editingTask} onclose={() => ui.closeTask()} />
<ShortcutsHelp />
