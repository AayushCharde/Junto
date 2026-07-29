<script lang="ts">
	// A small assignee "name tag": initials avatar + optional name. When there's
	// no assignee it renders a dashed placeholder.
	let {
		name = null,
		showName = true,
		class: cls = ''
	}: { name?: string | null; showName?: boolean; class?: string } = $props();

	const initial = $derived((name ?? '').trim() ? (name as string).trim()[0].toUpperCase() : '');
</script>

{#if name}
	<span class="inline-flex items-center gap-1.5 {cls}">
		<span
			class="bg-primary/15 text-primary grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold"
		>
			{initial}
		</span>
		{#if showName}<span class="truncate text-xs">{name}</span>{/if}
	</span>
{:else}
	<span class="text-muted-foreground inline-flex items-center gap-1.5 {cls}">
		<span
			class="border-border grid size-5 shrink-0 place-items-center rounded-full border border-dashed text-[10px]"
		>
			+
		</span>
		{#if showName}<span class="text-xs">Unassigned</span>{/if}
	</span>
{/if}
