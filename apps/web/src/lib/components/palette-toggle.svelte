<script lang="ts">
	import { onMount } from 'svelte';

	type Palette = 'cyan' | 'graphite';

	let palette = $state<Palette>('cyan');
	const isCyan = $derived(palette === 'cyan');

	onMount(() => {
		palette = document.documentElement.dataset.palette === 'graphite' ? 'graphite' : 'cyan';
	});

	function toggle() {
		palette = isCyan ? 'graphite' : 'cyan';
		document.documentElement.dataset.palette = palette;
		// Cookie (not localStorage) so the server can apply it on next SSR with no flash.
		document.cookie = `palette=${palette};path=/;max-age=31536000;samesite=lax`;
	}
</script>

<button
	type="button"
	role="switch"
	aria-checked={isCyan}
	aria-label="Switch color palette (Cyan / Graphite)"
	title={isCyan ? 'Cyan palette' : 'Graphite palette'}
	class="track"
	class:on={isCyan}
	onclick={toggle}
>
	<span class="knob"></span>
</button>

<style>
	.track {
		width: 46px;
		height: 26px;
		flex: none;
		padding: 3px;
		border: none;
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		cursor: pointer;
		background: #3a3a42;
		transition: background 0.2s ease;
	}
	.track.on {
		background: linear-gradient(90deg, #34d399, #3b82f6);
	}
	.knob {
		width: 20px;
		height: 20px;
		border-radius: 999px;
		background: #fff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
		transform: translateX(0);
		transition: transform 0.2s ease;
	}
	.track.on .knob {
		transform: translateX(20px);
	}
	.track:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}
	@media (prefers-reduced-motion: reduce) {
		.track,
		.knob {
			transition: none;
		}
	}
</style>
