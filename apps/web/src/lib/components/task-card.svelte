<script lang="ts">
	import { getTracker, type Task } from '$lib/state/tracker.svelte';
	import PriorityIcon from '$lib/components/priority-icon.svelte';
	import { formatDue, isOverdue } from '$lib/due';
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
	class="group border-border bg-card hover:border-ring/60 hover:bg-accent/30 focus-visible:border-ring focus-visible:ring-ring/50 relative cursor-grab rounded-lg border p-2.5 shadow-sm transition-all outline-none hover:shadow-md focus-visible:ring-[2px] active:cursor-grabbing"
	class:drop-indicator={indicator}
>
	{#if labels.length > 0}
		<div class="mb-1.5 flex flex-wrap gap-1">
			{#each labels as label (label.id)}
				<span
					class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-medium"
					style={`color:${label.color ?? '#a1a1aa'};background:color-mix(in srgb, ${label.color ?? '#a1a1aa'} 16%, transparent)`}
				>
					{label.name}
				</span>
			{/each}
		</div>
	{/if}

	<p class="text-foreground text-sm leading-snug">{task.title}</p>

	<div class="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
		<PriorityIcon priority={task.priority} class="size-3.5" />
		{#if task.dueDate}
			<span class="flex items-center gap-1 {overdue ? 'font-medium text-red-400' : ''}">
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
</div>

<style>
	.drop-indicator {
		box-shadow: inset 0 2px 0 0 var(--ring);
	}
</style>
