<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { TASK_PRIORITIES, TASK_PRIORITY_LABELS, type TaskPriority } from '@junto/core';
	import { Button } from '$lib/components/ui/button';
	import { getTracker } from '$lib/state/tracker.svelte';
	import { getUi } from '$lib/state/ui.svelte';
	import { formatRelative } from '$lib/activity';
	import PriorityIcon from '$lib/components/priority-icon.svelte';
	import NameTag from '$lib/components/name-tag.svelte';
	import TaskDetail from '$lib/components/task-detail.svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import ListTodo from '@lucide/svelte/icons/list-todo';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import MessageSquare from '@lucide/svelte/icons/message-square';

	const store = getTracker();
	const ui = getUi();

	type Tab = 'open' | 'closed' | 'all';
	let tab = $state<Tab>('open');
	let query = $state('');
	let priority = $state<TaskPriority | ''>('');
	let projectId = $state('');
	let sortBy = $state<'created' | 'updated'>('created');

	let isDesktop = $state(true);
	let selectedId = $state<string | null>(browser ? new URLSearchParams(location.search).get('view') : null);

	onMount(() => {
		const mq = window.matchMedia('(min-width: 1024px)');
		const update = () => (isDesktop = mq.matches);
		update();
		mq.addEventListener('change', update);
		return () => mq.removeEventListener('change', update);
	});

	const isOpen = (s: string) => s !== 'done' && s !== 'canceled';

	// Base set = top-level tasks after search / priority / project (status-agnostic).
	const base = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return store.tasks.filter(
			(t) =>
				t.parentTaskId === null &&
				(!q || t.title.toLowerCase().includes(q)) &&
				(priority === '' || t.priority === priority) &&
				(projectId === '' || t.projectId === projectId)
		);
	});
	const openCount = $derived(base.filter((t) => isOpen(t.status)).length);
	const closedCount = $derived(base.length - openCount);

	const rows = $derived.by(() => {
		const tabbed =
			tab === 'open'
				? base.filter((t) => isOpen(t.status))
				: tab === 'closed'
					? base.filter((t) => !isOpen(t.status))
					: base;
		const key = sortBy === 'updated' ? 'updatedAt' : 'createdAt';
		return [...tabbed].sort((a, b) => b[key].localeCompare(a[key]));
	});

	const selected = $derived(selectedId ? (store.tasks.find((t) => t.id === selectedId) ?? null) : null);
	const hasFilters = $derived(query.trim() !== '' || priority !== '' || projectId !== '');

	function syncUrl(id: string | null) {
		if (!browser) return;
		try {
			const u = new URL(location.href);
			if (id) u.searchParams.set('view', id);
			else u.searchParams.delete('view');
			replaceState(u, {});
		} catch {
			/* shallow routing unavailable — local state still drives the UI */
		}
	}
	function select(id: string) {
		if (isDesktop) {
			selectedId = id;
			syncUrl(id);
		} else {
			ui.openTask(id); // no room for a side pane on mobile → modal
		}
	}
	function clear() {
		query = '';
		priority = '';
		projectId = '';
	}

	const field =
		'border-input bg-background rounded-md border px-2 py-1 text-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[2px]';
	const tabCls = (active: boolean) =>
		`relative px-1 pb-2 text-sm font-medium transition-colors ${active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`;
</script>

<svelte:head><title>Issues · Junto</title></svelte:head>

<div class="flex min-h-0 flex-1">
	<!-- ── List pane ─────────────────────────────────────────── -->
	<div class="border-border flex min-h-0 w-full flex-col lg:w-[440px] lg:shrink-0 lg:border-r">
		<header class="border-border flex h-12 shrink-0 items-center justify-between border-b px-5">
			<div class="flex items-center gap-2">
				<ListTodo class="text-muted-foreground size-4" />
				<h1 class="text-sm font-semibold">Issues</h1>
			</div>
			<Button size="sm" onclick={() => ui.newTask({ projectId: projectId || store.projects[0]?.id || null })}>
				<Plus class="size-4" /> New
			</Button>
		</header>

		<!-- Tabs -->
		<div class="border-border flex items-center gap-4 border-b px-5 pt-2">
			<button class={tabCls(tab === 'open')} onclick={() => (tab = 'open')}>
				Open <span class="tabular-nums">{openCount}</span>
				{#if tab === 'open'}<span class="bg-primary absolute inset-x-0 -bottom-px h-0.5 rounded-full"></span>{/if}
			</button>
			<button class={tabCls(tab === 'closed')} onclick={() => (tab = 'closed')}>
				Closed <span class="tabular-nums">{closedCount}</span>
				{#if tab === 'closed'}<span class="bg-primary absolute inset-x-0 -bottom-px h-0.5 rounded-full"></span>{/if}
			</button>
			<button class={tabCls(tab === 'all')} onclick={() => (tab = 'all')}>
				All <span class="tabular-nums">{base.length}</span>
				{#if tab === 'all'}<span class="bg-primary absolute inset-x-0 -bottom-px h-0.5 rounded-full"></span>{/if}
			</button>
		</div>

		<!-- Filters -->
		<div class="border-border flex flex-wrap items-center gap-2 border-b px-5 py-2">
			<div class="relative min-w-40 flex-1">
				<Search class="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
				<input bind:value={query} placeholder="Search issues…" class="{field} w-full pl-7" />
			</div>
			<select bind:value={priority} class={field}>
				<option value="">Any priority</option>
				{#each TASK_PRIORITIES as p (p)}<option value={p}>{TASK_PRIORITY_LABELS[p]}</option>{/each}
			</select>
			<select bind:value={projectId} class={field}>
				<option value="">All projects</option>
				{#each store.projects as project (project.id)}<option value={project.id}>{project.name}</option>{/each}
			</select>
			<select bind:value={sortBy} class={field} aria-label="Sort by">
				<option value="created">Created</option>
				<option value="updated">Updated</option>
			</select>
			{#if hasFilters}
				<button onclick={clear} class="text-muted-foreground hover:text-foreground text-xs">Clear</button>
			{/if}
		</div>

		<!-- Rows -->
		<div class="min-h-0 flex-1 overflow-y-auto">
			{#if rows.length === 0}
				<div class="text-muted-foreground flex flex-col items-center justify-center gap-2 py-20">
					<ListTodo class="size-8 opacity-40" />
					<p class="text-sm">{hasFilters || tab !== 'all' ? 'No issues here.' : 'No issues yet.'}</p>
				</div>
			{:else}
				{#each rows as task (task.id)}
					{@const labels = store.labelsForTask(task.id)}
					{@const comments = store.commentCount(task.id)}
					{@const subs = store.subtaskProgress(task.id)}
					<div
						role="button"
						tabindex="0"
						onclick={() => select(task.id)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								select(task.id);
							}
						}}
						class="border-border/60 hover:bg-accent/40 flex cursor-pointer flex-col gap-1.5 border-b px-5 py-3 outline-none
							{selectedId === task.id ? 'bg-accent/60' : ''}"
					>
						<div class="flex items-start gap-2">
							<PriorityIcon priority={task.priority} class="mt-0.5 size-3.5 shrink-0" />
							<span class="min-w-0 flex-1 text-sm font-medium">{task.title}</span>
							{#if task.assigneeId}
								<NameTag name={store.memberName(task.assigneeId)} showName={false} class="shrink-0" />
							{/if}
						</div>
						{#if labels.length > 0}
							<div class="flex flex-wrap gap-1 pl-6">
								{#each labels.slice(0, 4) as label (label.id)}
									<span
										class="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
										style={`color:${label.color ?? '#a1a1aa'};background:color-mix(in srgb, ${label.color ?? '#a1a1aa'} 16%, transparent)`}
									>
										{label.name}
									</span>
								{/each}
							</div>
						{/if}
						<div class="text-muted-foreground flex items-center gap-3 pl-6 text-xs">
							<span>{store.projectById(task.projectId)?.name ?? ''}</span>
							<span>· created {formatRelative(task.createdAt)}</span>
							{#if comments > 0}
								<span class="flex items-center gap-1"><MessageSquare class="size-3" />{comments}</span>
							{/if}
							{#if subs.total > 0}
								<span class="flex items-center gap-1"><ListChecks class="size-3" />{subs.done}/{subs.total}</span>
							{/if}
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</div>

	<!-- ── Detail pane (desktop only) ────────────────────────── -->
	<div class="hidden min-h-0 flex-1 lg:block">
		{#if selected}
			<TaskDetail task={selected} onclose={() => { selectedId = null; syncUrl(null); }} />
		{:else}
			<div class="text-muted-foreground flex h-full flex-col items-center justify-center gap-2">
				<ListTodo class="size-10 opacity-30" />
				<p class="text-sm">Select an issue to preview.</p>
			</div>
		{/if}
	</div>
</div>
