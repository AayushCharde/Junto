<script lang="ts">
	// Junto mark — "Huddle": three people (emerald / cyan / blue) standing
	// together, the middle one stepping forward. Bare mark, no tile. Colors are
	// fixed brand values so the mark is identical across both palettes.
	let { class: cls = 'size-6' }: { class?: string } = $props();
</script>

<svg viewBox="0 0 64 64" fill="none" class={cls} role="img" aria-label="Junto">
	<g fill="#34d399"><circle cx="19" cy="27" r="5.4" /><rect x="12" y="33.5" width="14" height="16" rx="7" /></g>
	<g fill="#3b82f6"><circle cx="45" cy="27" r="5.4" /><rect x="38" y="33.5" width="14" height="16" rx="7" /></g>
	<g fill="#22d3ee"><circle cx="32" cy="21.5" r="6" /><rect x="24" y="29" width="16" height="18" rx="8" /></g>
</svg>
