<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		TASK_PRIORITIES,
		TASK_PRIORITY_LABELS,
		TASK_STATUS_LABELS,
		type TaskStatus
	} from '@junto/core';
	import { Button } from '$lib/components/ui/button';
	import TaskCard from '$lib/components/task-card.svelte';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import { getTracker, STATUS_COLUMNS, type Task } from '$lib/state/tracker.svelte';
	import { getUi } from '$lib/state/ui.svelte';
	import StatusIcon from '$lib/components/status-icon.svelte';
	import PriorityIcon from '$lib/components/priority-icon.svelte';
	import { formatDue, isOverdue } from '$lib/due';
	import Columns3 from '@lucide/svelte/icons/columns-3';
	import Inbox from '@lucide/svelte/icons/inbox';
	import ListIcon from '@lucide/svelte/icons/list';
	import Plus from '@lucide/svelte/icons/plus';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Archive from '@lucide/svelte/icons/archive';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';

	const store = getTracker();
	const ui = getUi();

	const projectId = $derived(page.params.projectId ?? '');
	const project = $derived(store.projectById(projectId));

	let drafts = $state<Record<string, string>>({});

	// Cap cards per status group; "Show more" reveals the rest. Reset per project.
	const CARD_PAGE = 50;
	let shown = $state<Record<string, number>>({});
	$effect(() => {
		projectId; // re-run when switching projects
		shown = {};
	});

	// Project management (rename / archive / delete)
	let menuOpen = $state(false);
	let renaming = $state(false);
	let draftName = $state('');
	let confirmDelete = $state(false);
	function focusEl(node: HTMLElement) {
		node.focus();
	}
	function startRename() {
		if (!project) return;
		draftName = project.name;
		renaming = true;
		menuOpen = false;
	}
	function commitRename() {
		const n = draftName.trim();
		renaming = false;
		if (project && n && n !== project.name) store.updateProject(project.id, { name: n });
	}

	// Drag state
	let draggedId = $state<string | null>(null);
	let dropTargetId = $state<string | null>(null);
	let dragOverStatus = $state<TaskStatus | null>(null);

	function openTask(task: Task) {
		ui.openTask(task.id);
	}

	function resetDrag() {
		draggedId = null;
		dropTargetId = null;
		dragOverStatus = null;
	}

	function onDragStart(event: DragEvent, task: Task) {
		draggedId = task.id;
		event.dataTransfer?.setData('text/plain', task.id);
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
	}

	function onCardDragOver(event: DragEvent, task: Task) {
		event.preventDefault();
		event.stopPropagation();
		dropTargetId = task.id;
		dragOverStatus = task.status;
	}

	function onCardDrop(event: DragEvent, target: Task) {
		event.preventDefault();
		event.stopPropagation();
		const id = event.dataTransfer?.getData('text/plain') || draggedId;
		resetDrag();
		if (!id || id === target.id) return;
		// Insert the dragged task directly before the target within its column.
		const seq = store.tasksByStatus(projectId, target.status).filter((t) => t.id !== id);
		const ti = seq.findIndex((t) => t.id === target.id);
		const prev = seq[ti - 1];
		const newSort = prev ? (prev.sortOrder + target.sortOrder) / 2 : target.sortOrder - 1;
		store.updateTask(id, { status: target.status, sortOrder: newSort });
	}

	function onColumnDrop(event: DragEvent, status: TaskStatus) {
		event.preventDefault();
		const id = event.dataTransfer?.getData('text/plain') || draggedId;
		resetDrag();
		if (!id) return;
		// Dropped in the column's empty area → append to the end.
		const seq = store.tasksByStatus(projectId, status).filter((t) => t.id !== id);
		const last = seq[seq.length - 1];
		const newSort = last ? last.sortOrder + 1 : Date.now();
		store.updateTask(id, { status, sortOrder: newSort });
	}

	async function quickAdd(status: TaskStatus, key: string) {
		const value = drafts[key]?.trim();
		if (!value) return;
		drafts[key] = '';
		await store.createTask(projectId, value, status);
	}
</script>

<svelte:head><title>{project?.name ?? 'Project'} · Junto</title></svelte:head>

{#if !project}
	<div class="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3">
		<Inbox class="size-10 opacity-40" />
		<p class="text-sm">Project not found.</p>
		<Button size="sm" href="/">Back to Home</Button>
	</div>
{:else}
	<header class="border-border flex h-12 shrink-0 items-center justify-between border-b px-5">
		<div class="flex min-w-0 items-center gap-2">
			<span class="size-2.5 shrink-0 rounded-full" style={`background:${project.color ?? '#71717a'}`}
			></span>
			{#if renaming}
				<input
					bind:value={draftName}
					use:focusEl
					onblur={commitRename}
					onkeydown={(e) => {
						if (e.key === 'Enter') e.currentTarget.blur();
						if (e.key === 'Escape') (renaming = false);
					}}
					class="border-input bg-background min-w-0 rounded border px-1.5 py-0.5 text-sm font-semibold outline-none"
				/>
			{:else}
				<h1 class="truncate text-sm font-semibold">{project.name}</h1>
			{/if}
			<span class="text-muted-foreground shrink-0 text-xs">{store.tasksForProject(projectId).length}</span>

			<!-- Manage menu -->
			<div class="relative">
				<button
					type="button"
					aria-label="Project actions"
					onclick={() => (menuOpen = !menuOpen)}
					class="text-muted-foreground hover:text-foreground hover:bg-accent rounded p-1"
				>
					<Ellipsis class="size-4" />
				</button>
				{#if menuOpen}
					<button type="button" aria-label="Close" class="fixed inset-0 z-10 cursor-default" onclick={() => (menuOpen = false)}></button>
					<div class="border-border bg-popover absolute left-0 top-8 z-20 w-40 rounded-md border p-1 text-sm shadow-xl">
						<button type="button" class="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5" onclick={startRename}>
							<Pencil class="size-3.5" /> Rename
						</button>
						<button type="button" class="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5" onclick={() => (store.updateProject(project.id, { archived: true }), (menuOpen = false), goto('/projects'))}>
							<Archive class="size-3.5" /> Archive
						</button>
						<button type="button" class="text-destructive hover:bg-destructive/10 flex w-full items-center gap-2 rounded px-2 py-1.5" onclick={() => ((confirmDelete = true), (menuOpen = false))}>
							<Trash2 class="size-3.5" /> Delete
						</button>
					</div>
				{/if}
			</div>
		</div>

		<div class="flex items-center gap-2">
			<Button size="sm" onclick={() => ui.newTask({ projectId, status: 'backlog' })}>
				<Plus class="size-4" /> New task
			</Button>
			<div class="border-border flex items-center rounded-md border p-0.5">
			<button
				onclick={() => store.setView('board')}
				class="flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors
					{store.view === 'board'
					? 'bg-accent text-accent-foreground'
					: 'text-muted-foreground hover:text-foreground'}"
			>
				<Columns3 class="size-3.5" /> Board
			</button>
			<button
				onclick={() => store.setView('list')}
				class="flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors
					{store.view === 'list'
					? 'bg-accent text-accent-foreground'
					: 'text-muted-foreground hover:text-foreground'}"
			>
				<ListIcon class="size-3.5" /> List
			</button>
			</div>
		</div>
	</header>

	<!-- Filters -->
	<div class="border-border flex items-center gap-2 border-b px-5 py-2 text-xs">
		<span class="text-muted-foreground">Filter</span>
		<select
			value={store.filterPriority ?? ''}
			onchange={(e) =>
				store.setFilterPriority((e.currentTarget.value || null) as (typeof TASK_PRIORITIES)[number] | null)}
			class="border-input bg-background rounded-md border px-2 py-1 text-xs outline-none"
		>
			<option value="">Any priority</option>
			{#each TASK_PRIORITIES as p (p)}
				<option value={p}>{TASK_PRIORITY_LABELS[p]}</option>
			{/each}
		</select>

		<select
			value={store.filterLabelId ?? ''}
			onchange={(e) => store.setFilterLabel(e.currentTarget.value || null)}
			class="border-input bg-background rounded-md border px-2 py-1 text-xs outline-none"
		>
			<option value="">Any label</option>
			{#each store.labels as label (label.id)}
				<option value={label.id}>{label.name}</option>
			{/each}
		</select>

		{#if store.hasActiveFilters}
			<button
				onclick={() => store.clearFilters()}
				class="text-muted-foreground hover:text-foreground flex items-center gap-1"
			>
				<X class="size-3" /> Clear
			</button>
		{/if}
	</div>

	{#if store.view === 'board'}
		<div class="flex flex-1 gap-3 overflow-x-auto p-4">
			{#each STATUS_COLUMNS as status (status)}
				{@const colRows = store.tasksByStatus(projectId, status)}
				{@const colLimit = shown[status] ?? CARD_PAGE}
				<section
					class="flex w-72 shrink-0 flex-col rounded-lg transition-colors
						{dragOverStatus === status ? 'bg-accent/40' : ''}"
					ondragover={(e) => {
						e.preventDefault();
						dragOverStatus = status;
						dropTargetId = null;
					}}
					ondragleave={() => {
						if (dragOverStatus === status) dragOverStatus = null;
					}}
					ondrop={(e) => onColumnDrop(e, status)}
					role="list"
					aria-label={TASK_STATUS_LABELS[status]}
				>
					<div class="mb-2 flex items-center gap-2 px-1">
						<StatusIcon {status} class="size-3.5" />
						<span class="text-sm font-medium">{TASK_STATUS_LABELS[status]}</span>
						<span
							class="bg-muted text-muted-foreground rounded-full px-1.5 text-[11px] tabular-nums"
						>
							{store.countByStatus(projectId, status)}
						</span>
					</div>

					<div class="flex min-h-2 flex-col gap-2 px-0.5">
						{#each colRows.slice(0, colLimit) as task (task.id)}
							<TaskCard
								{task}
								onopen={openTask}
								ondragstart={onDragStart}
								ondragover={onCardDragOver}
								ondrop={onCardDrop}
								indicator={dropTargetId === task.id}
							/>
						{/each}
						{#if colRows.length > colLimit}
							<button
								type="button"
								onclick={() => (shown = { ...shown, [status]: colLimit + CARD_PAGE })}
								class="text-muted-foreground hover:text-foreground hover:bg-accent/40 rounded-md px-2 py-1.5 text-xs"
							>
								Show {Math.min(CARD_PAGE, colRows.length - colLimit)} more…
							</button>
						{/if}
					</div>

					<input
						bind:value={drafts[status]}
						placeholder="+ Add task"
						onkeydown={(e) => {
							if (e.key === 'Enter') quickAdd(status, status);
						}}
						class="text-muted-foreground hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:text-foreground mt-2 w-full rounded-md border border-transparent px-2 py-1.5 text-sm outline-none transition-colors focus-visible:ring-[2px]"
					/>
				</section>
			{/each}
		</div>
	{:else}
		<div class="flex-1 overflow-y-auto">
			<div class="border-border flex items-center gap-2 border-b px-5 py-2">
				<Plus class="text-muted-foreground size-4" />
				<input
					bind:value={drafts['list']}
					placeholder="Add a task…"
					onkeydown={(e) => {
						if (e.key === 'Enter') quickAdd('backlog', 'list');
					}}
					class="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
				/>
			</div>

			{#each STATUS_COLUMNS as status (status)}
				{@const rows = store.tasksByStatus(projectId, status)}
				{@const limit = shown[status] ?? CARD_PAGE}
				{#if rows.length > 0}
					<div
						class="text-muted-foreground bg-muted/40 flex items-center gap-2 px-5 py-1.5 text-xs font-medium"
					>
						<StatusIcon {status} class="size-3.5" />
						{TASK_STATUS_LABELS[status]}
						<span class="tabular-nums">{rows.length}</span>
					</div>
					{#each rows.slice(0, limit) as task (task.id)}
						{@const taskLabels = store.labelsForTask(task.id)}
						<button
							onclick={() => openTask(task)}
							class="border-border/60 hover:bg-accent/40 flex w-full items-center gap-3 border-b px-5 py-2 text-left transition-colors"
						>
							<PriorityIcon priority={task.priority} class="size-3.5 shrink-0" />
							<span class="min-w-0 flex-1 truncate text-sm">{task.title}</span>
							{#each taskLabels.slice(0, 2) as label (label.id)}
								<span
									class="hidden shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium sm:inline"
									style={`color:${label.color ?? '#a1a1aa'};background:color-mix(in srgb, ${label.color ?? '#a1a1aa'} 16%, transparent)`}
								>
									{label.name}
								</span>
							{/each}
							{#if task.dueDate}
								<span
									class="shrink-0 text-xs {isOverdue(task.dueDate)
										? 'text-red-400'
										: 'text-muted-foreground'}"
								>
									{formatDue(task.dueDate)}
								</span>
							{/if}
						</button>
					{/each}
					{#if rows.length > limit}
						<button
							type="button"
							onclick={() => (shown = { ...shown, [status]: limit + CARD_PAGE })}
							class="text-muted-foreground hover:text-foreground hover:bg-accent/40 w-full border-b px-5 py-2 text-left text-xs"
						>
							Show {Math.min(CARD_PAGE, rows.length - limit)} more of {rows.length}…
						</button>
					{/if}
				{/if}
			{/each}

			{#if store.tasksForProject(projectId).length === 0}
				<div class="text-muted-foreground flex flex-col items-center justify-center gap-2 py-16">
					<Inbox class="size-8 opacity-40" />
					<p class="text-sm">
						{store.hasActiveFilters ? 'No tasks match the filters.' : 'No tasks yet. Add one above.'}
					</p>
				</div>
			{/if}
		</div>
	{/if}

	<ConfirmDialog
		bind:open={confirmDelete}
		title="Delete project?"
		message={`"${project.name}" and all its tasks will be permanently deleted. This cannot be undone.`}
		confirmLabel="Delete project"
		destructive
		onconfirm={async () => {
			const ok = await store.deleteProject(project.id);
			if (ok) goto('/');
		}}
	/>
{/if}
