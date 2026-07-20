<script lang="ts">
	import '@fontsource-variable/inter/index.css';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href="/icon.svg" /></svelte:head>

{@render children()}
