<script lang="ts">
	import {
		TASK_PRIORITIES,
		TASK_PRIORITY_LABELS,
		TASK_STATUS_LABELS,
		type TaskPriority
	} from '@junto/core';
	import { Button } from '$lib/components/ui/button';
	import { getTracker, STATUS_COLUMNS } from '$lib/state/tracker.svelte';
	import { getUi } from '$lib/state/ui.svelte';
	import StatusIcon from '$lib/components/status-icon.svelte';
	import PriorityIcon from '$lib/components/priority-icon.svelte';
	import { formatDue, isOverdue } from '$lib/due';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import ListTodo from '@lucide/svelte/icons/list-todo';
	import X from '@lucide/svelte/icons/x';

	const store = getTracker();
	const ui = getUi();

	// Local, view-only filters (don't touch the shared project-view filters).
	let query = $state('');
	let priority = $state<TaskPriority | ''>('');
	let projectId = $state('');

	const hasFilters = $derived(query.trim() !== '' || priority !== '' || projectId !== '');

	// All top-level tasks across every project, after the local filters.
	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return store.tasks.filter(
			(t) =>
				t.parentTaskId === null &&
				(!q || t.title.toLowerCase().includes(q)) &&
				(priority === '' || t.priority === priority) &&
				(projectId === '' || t.projectId === projectId)
		);
	});

	function forStatus(status: (typeof STATUS_COLUMNS)[number]) {
		return filtered
			.filter((t) => t.status === status)
			.sort((a, b) => a.sortOrder - b.sortOrder);
	}

	function clear() {
		query = '';
		priority = '';
		projectId = '';
	}

	const fieldClass =
		'border-input bg-background rounded-md border px-2 py-1 text-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[2px]';
</script>

<svelte:head><title>Issues · Junto</title></svelte:head>

<header class="border-border flex h-12 shrink-0 items-center justify-between border-b px-5">
	<div class="flex items-center gap-2">
		<ListTodo class="text-muted-foreground size-4" />
		<h1 class="text-sm font-semibold">Issues</h1>
		<span class="text-muted-foreground text-xs">{filtered.length}</span>
	</div>
	<Button size="sm" onclick={() => ui.newTask({ projectId: projectId || store.projects[0]?.id || null })}>
		<Plus class="size-4" /> New task
	</Button>
</header>

<!-- Filters -->
<div class="border-border flex flex-wrap items-center gap-2 border-b px-5 py-2 text-xs">
	<div class="relative">
		<Search class="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
		<input
			bind:value={query}
			placeholder="Search issues…"
			class="{fieldClass} w-52 pl-7"
		/>
	</div>

	<select bind:value={priority} class={fieldClass}>
		<option value="">Any priority</option>
		{#each TASK_PRIORITIES as p (p)}
			<option value={p}>{TASK_PRIORITY_LABELS[p]}</option>
		{/each}
	</select>

	<select bind:value={projectId} class={fieldClass}>
		<option value="">All projects</option>
		{#each store.projects as project (project.id)}
			<option value={project.id}>{project.name}</option>
		{/each}
	</select>

	{#if hasFilters}
		<button onclick={clear} class="text-muted-foreground hover:text-foreground flex items-center gap-1">
			<X class="size-3" /> Clear
		</button>
	{/if}
</div>

<div class="flex-1 overflow-y-auto">
	{#if filtered.length === 0}
		<div class="text-muted-foreground flex flex-col items-center justify-center gap-2 py-20">
			<ListTodo class="size-8 opacity-40" />
			<p class="text-sm">{hasFilters ? 'No issues match the filters.' : 'No issues yet. Create your first.'}</p>
		</div>
	{:else}
		{#each STATUS_COLUMNS as status (status)}
			{@const rows = forStatus(status)}
			{#if rows.length > 0}
				<div
					class="text-muted-foreground bg-muted/40 sticky top-0 flex items-center gap-2 px-5 py-1.5 text-xs font-medium backdrop-blur"
				>
					<StatusIcon {status} class="size-3.5" />
					{TASK_STATUS_LABELS[status]}
					<span class="tabular-nums">{rows.length}</span>
				</div>
				{#each rows as task (task.id)}
					{@const project = store.projectById(task.projectId)}
					{@const taskLabels = store.labelsForTask(task.id)}
					<div
						role="button"
						tabindex="0"
						onclick={() => ui.openTask(task.id)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								ui.openTask(task.id);
							}
						}}
						class="border-border/60 hover:bg-accent/40 flex w-full cursor-pointer items-center gap-3 border-b px-5 py-2 text-left transition-colors outline-none"
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
							<span class="shrink-0 text-xs {isOverdue(task.dueDate) ? 'text-red-400' : 'text-muted-foreground'}">
								{formatDue(task.dueDate)}
							</span>
						{/if}
						<a
							href={`/projects/${task.projectId}`}
							onclick={(e) => e.stopPropagation()}
							class="text-muted-foreground hover:text-foreground hidden shrink-0 items-center gap-1.5 text-xs sm:flex"
						>
							<span class="size-2 rounded-full" style={`background:${project?.color ?? '#71717a'}`}></span>
							{project?.name ?? ''}
						</a>
					</div>
				{/each}
			{/if}
		{/each}
	{/if}
</div>
