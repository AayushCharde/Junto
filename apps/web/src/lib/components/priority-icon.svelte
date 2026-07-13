<script lang="ts">
	import type { TaskPriority } from '@junto/core';
	import { PRIORITY_COLOR } from '$lib/tracker-meta';

	let { priority, class: cls = 'size-3.5' }: { priority: TaskPriority; class?: string } = $props();

	const level = $derived(
		priority === 'high' ? 3 : priority === 'medium' ? 2 : priority === 'low' ? 1 : 0
	);
</script>

<svg viewBox="0 0 14 14" class={cls} style={`color:${PRIORITY_COLOR[priority]}`} aria-hidden="true">
	{#if priority === 'urgent'}
		<rect x="1" y="1" width="12" height="12" rx="3.2" fill="currentColor" />
		<rect x="6.25" y="3.1" width="1.5" height="4.8" rx="0.75" fill="#fff" />
		<rect x="6.25" y="9" width="1.5" height="1.7" rx="0.75" fill="#fff" />
	{:else}
		<rect x="1.5" y="8.5" width="2.7" height="4" rx="0.6" fill={level >= 1 ? 'currentColor' : 'var(--muted-foreground)'} opacity={level >= 1 ? 1 : 0.35} />
		<rect x="5.65" y="5.5" width="2.7" height="7" rx="0.6" fill={level >= 2 ? 'currentColor' : 'var(--muted-foreground)'} opacity={level >= 2 ? 1 : 0.35} />
		<rect x="9.8" y="2.5" width="2.7" height="10" rx="0.6" fill={level >= 3 ? 'currentColor' : 'var(--muted-foreground)'} opacity={level >= 3 ? 1 : 0.35} />
	{/if}
</svg>
