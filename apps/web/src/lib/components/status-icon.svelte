<script lang="ts">
	import type { TaskStatus } from '@junto/core';
	import { STATUS_COLOR } from '$lib/tracker-meta';

	let { status, class: cls = 'size-3.5' }: { status: TaskStatus; class?: string } = $props();
</script>

<svg
	viewBox="0 0 14 14"
	class={cls}
	fill="none"
	style={`color:${STATUS_COLOR[status]}`}
	aria-hidden="true"
>
	{#if status === 'backlog'}
		<circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5" stroke-dasharray="1.6 1.7" />
	{:else if status === 'todo'}
		<circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5" />
	{:else if status === 'in_progress'}
		<circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.5" />
		<path d="M7 7 L7 1.5 A5.5 5.5 0 0 1 7 12.5 Z" fill="currentColor" />
	{:else if status === 'done'}
		<circle cx="7" cy="7" r="6.5" fill="currentColor" />
		<path
			d="M4.2 7.1 L6.1 9 L9.8 5.2"
			stroke="var(--background)"
			stroke-width="1.6"
			fill="none"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{:else}
		<circle cx="7" cy="7" r="6.5" fill="currentColor" />
		<path
			d="M4.8 4.8 L9.2 9.2 M9.2 4.8 L4.8 9.2"
			stroke="var(--background)"
			stroke-width="1.6"
			stroke-linecap="round"
		/>
	{/if}
</svg>
