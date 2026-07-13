<script lang="ts">
	import { onMount } from 'svelte';
	import { TASK_STATUS_LABELS, type TaskStatus } from '@junto/core';
	import { Button } from '$lib/components/ui/button';
	import TaskCard from '$lib/components/task-card.svelte';
	import TaskEditor from '$lib/components/task-editor.svelte';
	import { STATUS_COLUMNS, TrackerStore, type Task } from '$lib/state/tracker.svelte';
	import { PRIORITY_DOT, STATUS_DOT } from '$lib/tracker-meta';
	import Circle from '@lucide/svelte/icons/circle';
	import Columns3 from '@lucide/svelte/icons/columns-3';
	import Inbox from '@lucide/svelte/icons/inbox';
	import ListIcon from '@lucide/svelte/icons/list';
	import Plus from '@lucide/svelte/icons/plus';

	let { data } = $props();

	const store = new TrackerStore({
		workspaceId: data.workspace?.id ?? null,
		projects: data.projects,
		tasks: data.tasks
	});

	let editing = $state<Task | null>(null);
	let dragOverStatus = $state<TaskStatus | null>(null);

	// New-project inline input.
	let addingProject = $state(false);
	let newProjectName = $state('');

	// Quick-add draft text, keyed by status column (board) or a single one (list).
	let drafts = $state<Record<string, string>>({});

	onMount(() => {
		store.startRealtime();
		return () => store.stopRealtime();
	});

	function openTask(task: Task) {
		editing = task;
	}

	function handleDragStart(event: DragEvent, task: Task) {
		event.dataTransfer?.setData('text/plain', task.id);
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
	}

	function handleDrop(event: DragEvent, status: TaskStatus) {
		event.preventDefault();
		dragOverStatus = null;
		const id = event.dataTransfer?.getData('text/plain');
		if (id) store.moveTask(id, status);
	}

	async function quickAdd(status: TaskStatus, key: string) {
		const value = drafts[key]?.trim();
		if (!value) return;
		drafts[key] = '';
		await store.createTask(value, status);
	}

	function focusOnMount(node: HTMLElement) {
		node.focus();
	}

	async function submitNewProject() {
		const name = newProjectName.trim();
		if (!name) {
			addingProject = false;
			return;
		}
		newProjectName = '';
		addingProject = false;
		await store.createProject(name);
	}
</script>

<svelte:head><title>Junto</title></svelte:head>

<div class="bg-background text-foreground flex h-screen overflow-hidden">
	<!-- Sidebar -->
	<aside class="border-border bg-sidebar flex w-60 shrink-0 flex-col border-r">
		<div class="border-border flex h-12 items-center border-b px-4">
			<span class="text-sm font-semibold tracking-tight">Junto</span>
		</div>

		<nav class="flex-1 overflow-y-auto p-2">
			<div class="text-muted-foreground flex items-center justify-between px-2 py-1.5">
				<span class="text-xs font-medium tracking-wide uppercase">Projects</span>
				<button
					class="hover:text-foreground rounded p-0.5"
					aria-label="New project"
					onclick={() => {
						addingProject = true;
					}}
				>
					<Plus class="size-4" />
				</button>
			</div>

			{#each store.projects as project (project.id)}
				<button
					onclick={() => store.selectProject(project.id)}
					class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors
						{store.currentProjectId === project.id
						? 'bg-accent text-accent-foreground'
						: 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}"
				>
					<span
						class="size-2.5 shrink-0 rounded-full"
						style={`background:${project.color ?? '#71717a'}`}
					></span>
					<span class="truncate">{project.name}</span>
				</button>
			{/each}

			{#if addingProject}
				<input
					bind:value={newProjectName}
					placeholder="Project name"
					use:focusOnMount
					onblur={submitNewProject}
					onkeydown={(e) => {
						if (e.key === 'Enter') submitNewProject();
						if (e.key === 'Escape') {
							newProjectName = '';
							addingProject = false;
						}
					}}
					class="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 mt-1 w-full rounded-md border px-2 py-1.5 text-sm outline-none focus-visible:ring-[2px]"
				/>
			{/if}

			{#if store.projects.length === 0 && !addingProject}
				<p class="text-muted-foreground px-2 py-2 text-xs">No projects yet.</p>
			{/if}
		</nav>
	</aside>

	<!-- Main -->
	<main class="flex min-w-0 flex-1 flex-col">
		<header class="border-border flex h-12 shrink-0 items-center justify-between border-b px-4">
			<div class="flex items-center gap-2">
				<h1 class="text-sm font-semibold">{store.currentProject?.name ?? 'No project'}</h1>
				<span class="text-muted-foreground text-xs">{store.visibleTasks.length}</span>
			</div>

			<div class="flex items-center gap-1">
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

		{#if !store.currentProject}
			<div class="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3">
				<Inbox class="size-10 opacity-40" />
				<p class="text-sm">Create a project to get started.</p>
				<Button size="sm" onclick={() => (addingProject = true)}>
					<Plus class="size-4" /> New project
				</Button>
			</div>
		{:else if store.view === 'board'}
			<!-- Board -->
			<div class="flex flex-1 gap-3 overflow-x-auto p-4">
				{#each STATUS_COLUMNS as status (status)}
					<section
						class="flex w-72 shrink-0 flex-col rounded-lg transition-colors
							{dragOverStatus === status ? 'bg-accent/40' : ''}"
						ondragover={(e) => {
							e.preventDefault();
							dragOverStatus = status;
						}}
						ondragleave={() => {
							if (dragOverStatus === status) dragOverStatus = null;
						}}
						ondrop={(e) => handleDrop(e, status)}
						role="list"
						aria-label={TASK_STATUS_LABELS[status]}
					>
						<div class="mb-1 flex items-center gap-2 px-1 py-1">
							<Circle class="size-2.5 fill-current {STATUS_DOT[status]}" />
							<span class="text-sm font-medium">{TASK_STATUS_LABELS[status]}</span>
							<span class="text-muted-foreground text-xs">{store.countByStatus(status)}</span>
						</div>

						<div class="flex flex-col gap-2 px-0.5">
							{#each store.tasksByStatus(status) as task (task.id)}
								<TaskCard {task} onopen={openTask} ondragstart={handleDragStart} />
							{/each}
						</div>

						<input
							bind:value={drafts[status]}
							placeholder="+ Add task"
							onkeydown={(e) => {
								if (e.key === 'Enter') quickAdd(status, status);
							}}
							class="text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:text-foreground mt-2 w-full rounded-md border border-transparent px-2 py-1.5 text-sm outline-none focus-visible:ring-[2px]"
						/>
					</section>
				{/each}
			</div>
		{:else}
			<!-- List -->
			<div class="flex-1 overflow-y-auto">
				<div class="border-border flex items-center gap-2 border-b px-4 py-2">
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
					{@const rows = store.tasksByStatus(status)}
					{#if rows.length > 0}
						<div
							class="text-muted-foreground bg-muted/40 flex items-center gap-2 px-4 py-1.5 text-xs font-medium"
						>
							<Circle class="size-2.5 fill-current {STATUS_DOT[status]}" />
							{TASK_STATUS_LABELS[status]}
							<span>{rows.length}</span>
						</div>
						{#each rows as task (task.id)}
							<button
								onclick={() => openTask(task)}
								class="border-border/60 hover:bg-accent/40 flex w-full items-center gap-3 border-b px-4 py-2 text-left"
							>
								<Circle
									class="size-3 shrink-0 fill-current {task.priority === 'none'
										? 'text-transparent'
										: PRIORITY_DOT[task.priority]}"
								/>
								<span class="min-w-0 flex-1 truncate text-sm">{task.title}</span>
							</button>
						{/each}
					{/if}
				{/each}

				{#if store.visibleTasks.length === 0}
					<div class="text-muted-foreground flex flex-col items-center justify-center gap-2 py-16">
						<Inbox class="size-8 opacity-40" />
						<p class="text-sm">No tasks yet. Add one above.</p>
					</div>
				{/if}
			</div>
		{/if}
	</main>
</div>

<TaskEditor
	task={editing}
	onclose={() => (editing = null)}
	onsave={(id, patch) => store.updateTask(id, patch)}
	ondelete={(id) => store.deleteTask(id)}
/>
