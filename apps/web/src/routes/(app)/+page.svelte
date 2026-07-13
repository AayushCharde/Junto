<script lang="ts">
	import { onMount } from 'svelte';
	import { TASK_STATUS_LABELS } from '@junto/core';
	import { getTracker, STATUS_COLUMNS } from '$lib/state/tracker.svelte';
	import StatusIcon from '$lib/components/status-icon.svelte';
	import PriorityIcon from '$lib/components/priority-icon.svelte';
	import { STATUS_COLOR } from '$lib/tracker-meta';
	import { formatDue, isOverdue } from '$lib/due';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleDot from '@lucide/svelte/icons/circle-dot';
	import Inbox from '@lucide/svelte/icons/inbox';
	import LayoutList from '@lucide/svelte/icons/layout-list';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';

	const store = getTracker();

	const overdueCount = $derived(
		store.tasks.filter(
			(t) =>
				t.parentTaskId === null &&
				t.status !== 'done' &&
				t.status !== 'canceled' &&
				isOverdue(t.dueDate)
		).length
	);

	const tiles = $derived([
		{ label: 'Total', value: store.totalTasks, icon: LayoutList, tint: 'text-muted-foreground' },
		{ label: 'Active', value: store.activeTasks.length, icon: CircleDot, tint: 'text-amber-400' },
		{ label: 'Done', value: store.doneCount, icon: CircleCheck, tint: 'text-emerald-400' },
		{ label: 'Overdue', value: overdueCount, icon: TriangleAlert, tint: 'text-red-400' }
	]);

	let greeting = $state('Welcome back');
	onMount(() => {
		const h = new Date().getHours();
		greeting =
			h < 5 ? 'Working late' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
	});
</script>

<svelte:head><title>Home · Junto</title></svelte:head>

<header class="border-border flex h-12 shrink-0 items-center border-b px-5">
	<h1 class="text-sm font-semibold">Home</h1>
</header>

<div class="flex-1 overflow-y-auto">
	<div class="mx-auto max-w-5xl space-y-8 p-6">
		<div>
			<h2 class="text-2xl font-semibold tracking-tight">{greeting}</h2>
			<p class="text-muted-foreground mt-1 text-sm">
				{store.totalTasks === 0
					? 'No tasks yet — open a project and add your first.'
					: `You have ${store.activeTasks.length} active ${store.activeTasks.length === 1 ? 'task' : 'tasks'}${overdueCount > 0 ? `, ${overdueCount} overdue` : ''}.`}
			</p>
		</div>

		<!-- Stat tiles -->
		<section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#each tiles as tile (tile.label)}
				{@const Icon = tile.icon}
				<div class="border-border bg-card rounded-xl border p-4">
					<div class="flex items-center justify-between">
						<p class="text-muted-foreground text-xs font-medium">{tile.label}</p>
						<Icon class="size-4 {tile.tint}" />
					</div>
					<p class="mt-2 text-2xl font-semibold tabular-nums">{tile.value}</p>
				</div>
			{/each}
		</section>

		<!-- Status distribution -->
		<section class="border-border bg-card rounded-xl border p-5">
			<h3 class="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
				Distribution
			</h3>
			<div class="bg-muted flex h-2.5 w-full overflow-hidden rounded-full">
				{#each STATUS_COLUMNS as status (status)}
					{@const count = store.statusCount(status)}
					{#if count > 0 && store.totalTasks > 0}
						<div
							style={`width:${(count / store.totalTasks) * 100}%;background:${STATUS_COLOR[status]}`}
							title={`${TASK_STATUS_LABELS[status]}: ${count}`}
						></div>
					{/if}
				{/each}
			</div>
			<div class="mt-3 flex flex-wrap gap-x-5 gap-y-2">
				{#each STATUS_COLUMNS as status (status)}
					<div class="flex items-center gap-1.5">
						<StatusIcon {status} class="size-3.5" />
						<span class="text-sm">{TASK_STATUS_LABELS[status]}</span>
						<span class="text-muted-foreground text-sm tabular-nums">{store.statusCount(status)}</span>
					</div>
				{/each}
			</div>
		</section>

		<!-- Projects -->
		<section>
			<h3 class="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">Projects</h3>
			{#if store.projects.length === 0}
				<div
					class="border-border text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-sm"
				>
					<Inbox class="size-8 opacity-40" />
					Create a project from the sidebar to get started.
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each store.projects as project (project.id)}
						{@const stats = store.projectStats(project.id)}
						{@const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0}
						<a
							href={`/projects/${project.id}`}
							class="border-border bg-card hover:border-ring/60 hover:bg-accent/30 group rounded-xl border p-4 transition-all hover:shadow-md"
						>
							<div class="flex items-center gap-2">
								<span
									class="size-2.5 shrink-0 rounded-full"
									style={`background:${project.color ?? '#71717a'}`}
								></span>
								<span class="truncate text-sm font-medium">{project.name}</span>
								<span class="text-muted-foreground ml-auto text-xs tabular-nums">{pct}%</span>
							</div>
							<div class="bg-muted mt-3 h-1.5 w-full overflow-hidden rounded-full">
								<div class="bg-primary h-full rounded-full" style={`width:${pct}%`}></div>
							</div>
							<div class="text-muted-foreground mt-2 flex items-center gap-4 text-xs">
								<span>{stats.total} total</span>
								<span>{stats.active} active</span>
								<span>{stats.done} done</span>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</section>

		<!-- Active tasks -->
		<section>
			<h3 class="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
				Active tasks
			</h3>
			{#if store.activeTasks.length === 0}
				<p class="text-muted-foreground text-sm">Nothing in progress. Enjoy the calm.</p>
			{:else}
				<div class="border-border divide-border bg-card divide-y overflow-hidden rounded-xl border">
					{#each store.activeTasks.slice(0, 12) as task (task.id)}
						{@const project = store.projectById(task.projectId)}
						<a
							href={`/projects/${task.projectId}`}
							class="hover:bg-accent/40 flex items-center gap-3 px-4 py-2.5 transition-colors"
						>
							<PriorityIcon priority={task.priority} class="size-3.5 shrink-0" />
							<StatusIcon status={task.status} class="size-3.5 shrink-0" />
							<span class="min-w-0 flex-1 truncate text-sm">{task.title}</span>
							{#if task.dueDate}
								<span
									class="shrink-0 text-xs {isOverdue(task.dueDate)
										? 'text-red-400'
										: 'text-muted-foreground'}"
								>
									{formatDue(task.dueDate)}
								</span>
							{/if}
							<span class="text-muted-foreground hidden shrink-0 text-xs sm:inline">
								{project?.name ?? ''}
							</span>
						</a>
					{/each}
				</div>
			{/if}
		</section>
	</div>
</div>
