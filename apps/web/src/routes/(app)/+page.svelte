<script lang="ts">
	import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from '@junto/core';
	import { getTracker, STATUS_COLUMNS } from '$lib/state/tracker.svelte';
	import { PRIORITY_DOT, STATUS_DOT } from '$lib/tracker-meta';
	import Circle from '@lucide/svelte/icons/circle';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Inbox from '@lucide/svelte/icons/inbox';

	const store = getTracker();

	const tiles = $derived([
		{ label: 'Total tasks', value: store.totalTasks },
		{ label: 'Active', value: store.activeTasks.length },
		{ label: 'Done', value: store.doneCount },
		{ label: 'Projects', value: store.projects.length }
	]);
</script>

<svelte:head><title>Home · Junto</title></svelte:head>

<header class="border-border flex h-12 shrink-0 items-center border-b px-5">
	<h1 class="text-sm font-semibold">Home</h1>
</header>

<div class="flex-1 overflow-y-auto">
	<div class="mx-auto max-w-5xl space-y-8 p-6">
		<!-- Stat tiles -->
		<section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#each tiles as tile (tile.label)}
				<div class="border-border bg-card rounded-lg border p-4">
					<p class="text-muted-foreground text-xs font-medium">{tile.label}</p>
					<p class="mt-1 text-2xl font-semibold tabular-nums">{tile.value}</p>
				</div>
			{/each}
		</section>

		<!-- Status breakdown -->
		<section>
			<h2 class="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
				By status
			</h2>
			<div class="border-border bg-card flex flex-wrap gap-x-6 gap-y-2 rounded-lg border p-4">
				{#each STATUS_COLUMNS as status (status)}
					<div class="flex items-center gap-2">
						<Circle class="size-2.5 fill-current {STATUS_DOT[status]}" />
						<span class="text-sm">{TASK_STATUS_LABELS[status]}</span>
						<span class="text-muted-foreground text-sm tabular-nums">
							{store.statusCount(status)}
						</span>
					</div>
				{/each}
			</div>
		</section>

		<!-- Projects grid -->
		<section>
			<h2 class="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
				Projects
			</h2>
			{#if store.projects.length === 0}
				<div
					class="border-border text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-sm"
				>
					<Inbox class="size-8 opacity-40" />
					Create a project from the sidebar to get started.
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each store.projects as project (project.id)}
						{@const stats = store.projectStats(project.id)}
						<a
							href={`/projects/${project.id}`}
							class="border-border bg-card hover:border-ring/60 group rounded-lg border p-4 transition-colors"
						>
							<div class="flex items-center gap-2">
								<span
									class="size-2.5 shrink-0 rounded-full"
									style={`background:${project.color ?? '#71717a'}`}
								></span>
								<span class="truncate text-sm font-medium">{project.name}</span>
							</div>
							<div class="text-muted-foreground mt-3 flex items-center gap-4 text-xs">
								<span>{stats.total} total</span>
								<span>{stats.active} active</span>
								<span class="flex items-center gap-1">
									<CircleCheck class="size-3.5 text-emerald-400" />
									{stats.done}
								</span>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</section>

		<!-- Active tasks across projects -->
		<section>
			<h2 class="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
				Active tasks
			</h2>
			{#if store.activeTasks.length === 0}
				<p class="text-muted-foreground text-sm">Nothing in progress. Enjoy the calm.</p>
			{:else}
				<div class="border-border divide-border bg-card divide-y overflow-hidden rounded-lg border">
					{#each store.activeTasks.slice(0, 12) as task (task.id)}
						{@const project = store.projectById(task.projectId)}
						<a
							href={`/projects/${task.projectId}`}
							class="hover:bg-accent/40 flex items-center gap-3 px-4 py-2.5"
						>
							<Circle
								class="size-3 shrink-0 fill-current {task.priority === 'none'
									? 'text-transparent'
									: PRIORITY_DOT[task.priority]}"
							/>
							<span class="min-w-0 flex-1 truncate text-sm">{task.title}</span>
							{#if task.priority !== 'none'}
								<span class="text-muted-foreground hidden text-xs sm:inline">
									{TASK_PRIORITY_LABELS[task.priority]}
								</span>
							{/if}
							<span class="text-muted-foreground shrink-0 text-xs">{project?.name ?? ''}</span>
						</a>
					{/each}
				</div>
			{/if}
		</section>
	</div>
</div>
