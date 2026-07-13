<script lang="ts">
	import '@fontsource-variable/inter/index.css';
	import '../app.css';
	import { onMount } from 'svelte';
	import { ModeWatcher } from 'mode-watcher';
	import favicon from '$lib/assets/favicon.svg';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import { setTracker, TrackerStore } from '$lib/state/tracker.svelte';

	let { data, children } = $props();

	const store = setTracker(
		new TrackerStore({
			workspaceId: data.workspace?.id ?? null,
			workspaceName: data.workspace?.name ?? 'Workspace',
			projects: data.projects,
			tasks: data.tasks
		})
	);

	onMount(() => {
		store.startRealtime();
		return () => store.stopRealtime();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<ModeWatcher defaultMode="dark" />

<div class="bg-background text-foreground flex h-screen overflow-hidden">
	<AppSidebar />
	<div class="flex min-w-0 flex-1 flex-col">
		{@render children()}
	</div>
</div>
