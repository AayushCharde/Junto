<script lang="ts">
	import { page } from '$app/state';
	import { TASK_STATUS_LABELS, type TaskStatus } from '@junto/core';
	import { Button } from '$lib/components/ui/button';
	import TaskCard from '$lib/components/task-card.svelte';
	import TaskEditor from '$lib/components/task-editor.svelte';
	import { getTracker, STATUS_COLUMNS, type Task } from '$lib/state/tracker.svelte';
	import { PRIORITY_DOT, STATUS_DOT } from '$lib/tracker-meta';
	import Circle from '@lucide/svelte/icons/circle';
	import Columns3 from '@lucide/svelte/icons/columns-3';
	import Inbox from '@lucide/svelte/icons/inbox';
	import ListIcon from '@lucide/svelte/icons/list';
	import Plus from '@lucide/svelte/icons/plus';

	const store = getTracker();

	const projectId = $derived(page.params.projectId ?? '');
	const project = $derived(store.projectById(projectId));

	let editing = $state<Task | null>(null);
	let dragOverStatus = $state<TaskStatus | null>(null);
	let drafts = $state<Record<string, string>>({});

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
		<div class="flex items-center gap-2">
			<span
				class="size-2.5 shrink-0 rounded-full"
				style={`background:${project.color ?? '#71717a'}`}
			></span>
			<h1 class="text-sm font-semibold">{project.name}</h1>
			<span class="text-muted-foreground text-xs">{store.tasksForProject(projectId).length}</span>
		</div>

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
	</header>

	{#if store.view === 'board'}
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
						<span class="text-muted-foreground text-xs">{store.countByStatus(projectId, status)}</span>
					</div>

					<div class="flex flex-col gap-2 px-0.5">
						{#each store.tasksByStatus(projectId, status) as task (task.id)}
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
				{#if rows.length > 0}
					<div
						class="text-muted-foreground bg-muted/40 flex items-center gap-2 px-5 py-1.5 text-xs font-medium"
					>
						<Circle class="size-2.5 fill-current {STATUS_DOT[status]}" />
						{TASK_STATUS_LABELS[status]}
						<span>{rows.length}</span>
					</div>
					{#each rows as task (task.id)}
						<button
							onclick={() => openTask(task)}
							class="border-border/60 hover:bg-accent/40 flex w-full items-center gap-3 border-b px-5 py-2 text-left"
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

			{#if store.tasksForProject(projectId).length === 0}
				<div class="text-muted-foreground flex flex-col items-center justify-center gap-2 py-16">
					<Inbox class="size-8 opacity-40" />
					<p class="text-sm">No tasks yet. Add one above.</p>
				</div>
			{/if}
		</div>
	{/if}
{/if}

<TaskEditor
	task={editing}
	onclose={() => (editing = null)}
	onsave={(id, patch) => store.updateTask(id, patch)}
	ondelete={(id) => store.deleteTask(id)}
/>
