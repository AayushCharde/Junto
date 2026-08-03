<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Aayush Charde -->
<script lang="ts">
	import type { Label } from '$lib/state/tracker.svelte';

	// Renders a label pill. Scoped labels ("scope::value") get a GitLab-style
	// two-tone treatment: a muted scope segment + a colored value segment.
	let { label, class: cls = '' }: { label: Label; class?: string } = $props();

	const at = $derived(label.name.indexOf('::'));
	const scope = $derived(at >= 0 ? label.name.slice(0, at) : null);
	const value = $derived(at >= 0 ? label.name.slice(at + 2) : label.name);
	const color = $derived(label.color ?? '#a1a1aa');
</script>

{#if scope}
	<span class="inline-flex items-center overflow-hidden rounded-full text-[10px] leading-none font-medium {cls}">
		<span class="px-1.5 py-0.5" style={`background:color-mix(in srgb, ${color} 32%, #000 58%);color:#e6e6ea`}>{scope}</span>
		<span class="px-1.5 py-0.5" style={`color:${color};background:color-mix(in srgb, ${color} 20%, transparent)`}>{value}</span>
	</span>
{:else}
	<span
		class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] leading-none font-medium {cls}"
		style={`color:${color};background:color-mix(in srgb, ${color} 16%, transparent)`}
	>
		{value}
	</span>
{/if}
