<script lang="ts">
	import '@fontsource-variable/inter/index.css';
	import '../app.css';
	import { ModeWatcher } from 'mode-watcher';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<!-- Dark mode is the default; mode-watcher persists the user's choice thereafter. -->
<ModeWatcher defaultMode="dark" />

{@render children()}
