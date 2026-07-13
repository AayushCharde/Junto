<script lang="ts">
	import { TASK_PRIORITY_LABELS } from '@junto/core';
	import { getTracker, type Task } from '$lib/state/tracker.svelte';
	import { PRIORITY_DOT } from '$lib/tracker-meta';
	import { formatDue, isOverdue } from '$lib/due';
	import Circle from '@lucide/svelte/icons/circle';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import ListChecks from '@lucide/svelte/icons/list-checks';

	let {
		task,
		onopen,
		ondragstart,
		ondragover,
		ondrop,
		indicator = false
	}: {
		task: Task;
		onopen: (task: Task) => void;
		ondragstart: (event: DragEvent, task: Task) => void;
		ondragover: (event: DragEvent, task: Task) => void;
		ondrop: (event: DragEvent, task: Task) => void;
		indicator?: boolean;
	} = $props();

	const store = getTracker();
	const labels = $derived(store.labelsForTask(task.id));
	const sub = $derived(store.subtaskProgress(task.id));
	const overdue = $derived(isOverdue(task.dueDate));
</script>

<div
	role="button"
	tabindex="0"
	draggable="true"
	ondragstart={(e) => ondragstart(e, task)}
	ondragover={(e) => ondragover(e, task)}
	ondrop={(e) => ondrop(e, task)}
	onclick={() => onopen(task)}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onopen(task);
		}
	}}
	class="group border-border bg-card hover:border-ring/60 focus-visible:border-ring focus-visible:ring-ring/50 relative cursor-grab rounded-md border p-2.5 shadow-xs transition-colors outline-none focus-visible:ring-[2px] active:cursor-grabbing"
	class:drop-indicator={indicator}
>
	<p class="text-foreground text-sm leading-snug">{task.title}</p>

	{#if labels.length > 0}
		<div class="mt-2 flex flex-wrap gap-1">
			{#each labels as label (label.id)}
				<span
					class="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] leading-none"
					style={`color:${label.color ?? '#a1a1aa'};border-color:color-mix(in srgb, ${label.color ?? '#a1a1aa'} 40%, transparent)`}
				>
					<span class="size-1.5 rounded-full" style={`background:${label.color ?? '#a1a1aa'}`}></span>
					{label.name}
				</span>
			{/each}
		</div>
	{/if}

	{#if task.priority !== 'none' || task.dueDate || sub.total > 0}
		<div class="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
			{#if task.priority !== 'none'}
				<span class="flex items-center gap-1">
					<Circle class="size-2.5 fill-current {PRIORITY_DOT[task.priority]}" />
					{TASK_PRIORITY_LABELS[task.priority]}
				</span>
			{/if}
			{#if task.dueDate}
				<span class="flex items-center gap-1 {overdue ? 'text-red-400' : ''}">
					<CalendarDays class="size-3" />
					{formatDue(task.dueDate)}
				</span>
			{/if}
			{#if sub.total > 0}
				<span class="flex items-center gap-1">
					<ListChecks class="size-3" />
					{sub.done}/{sub.total}
				</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	.drop-indicator {
		box-shadow: inset 0 2px 0 0 var(--ring);
	}
</style>
