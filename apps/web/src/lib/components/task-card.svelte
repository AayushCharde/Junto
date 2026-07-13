<script lang="ts">
	import { TASK_PRIORITY_LABELS } from '@junto/core';
	import { PRIORITY_DOT } from '$lib/tracker-meta';
	import Circle from '@lucide/svelte/icons/circle';
	import type { Task } from '$lib/state/tracker.svelte';

	let {
		task,
		onopen,
		ondragstart
	}: {
		task: Task;
		onopen: (task: Task) => void;
		ondragstart: (event: DragEvent, task: Task) => void;
	} = $props();
</script>

<div
	role="button"
	tabindex="0"
	draggable="true"
	ondragstart={(e) => ondragstart(e, task)}
	onclick={() => onopen(task)}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onopen(task);
		}
	}}
	class="group border-border bg-card hover:border-ring/60 focus-visible:border-ring focus-visible:ring-ring/50 cursor-grab rounded-md border p-2.5 shadow-xs transition-colors outline-none focus-visible:ring-[2px] active:cursor-grabbing"
>
	<p class="text-foreground text-sm leading-snug">{task.title}</p>
	{#if task.priority !== 'none'}
		<div class="mt-2 flex items-center gap-1.5">
			<Circle class="size-2.5 fill-current {PRIORITY_DOT[task.priority]}" />
			<span class="text-muted-foreground text-xs">{TASK_PRIORITY_LABELS[task.priority]}</span>
		</div>
	{/if}
</div>
