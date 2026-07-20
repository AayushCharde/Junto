<script lang="ts">
	import { onMount } from 'svelte';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import { setTracker, TrackerStore } from '$lib/state/tracker.svelte';

	let { data, children } = $props();

	const store = setTracker(
		new TrackerStore({
			workspaceId: data.workspace?.id ?? null,
			workspaceName: data.workspace?.name ?? 'Workspace',
			currentUserId: data.user?.id ?? null,
			currentUserName: data.user?.email ?? null,
			projects: data.projects,
			tasks: data.tasks,
			labels: data.labels,
			taskLabels: data.taskLabels,
			comments: data.comments,
			activity: data.activity
		})
	);

	onMount(() => {
		store.startRealtime();
		return () => store.stopRealtime();
	});
</script>

<div class="flex h-screen overflow-hidden">
	<AppSidebar userEmail={data.user?.email ?? null} />
	<div class="flex min-w-0 flex-1 flex-col">
		{@render children()}
	</div>
</div>
