<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Aayush Charde -->
<script lang="ts">
	import '@fontsource-variable/inter/index.css';
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href="/icon.svg" /></svelte:head>

{@render children()}
