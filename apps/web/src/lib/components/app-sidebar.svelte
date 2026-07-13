<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { getTracker } from '$lib/state/tracker.svelte';
	import House from '@lucide/svelte/icons/house';
	import Plus from '@lucide/svelte/icons/plus';

	const store = getTracker();

	let addingProject = $state(false);
	let newProjectName = $state('');

	function focusOnMount(node: HTMLElement) {
		node.focus();
	}

	function isActive(path: string): boolean {
		return page.url.pathname === path;
	}

	async function submitNewProject() {
		const name = newProjectName.trim();
		newProjectName = '';
		addingProject = false;
		if (!name) return;
		const id = await store.createProject(name);
		if (id) goto(`/projects/${id}`);
	}
</script>

<aside class="border-border bg-sidebar flex w-60 shrink-0 flex-col border-r">
	<div class="border-border flex h-12 items-center gap-2 border-b px-4">
		<div class="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded text-xs font-bold">
			J
		</div>
		<span class="truncate text-sm font-semibold tracking-tight">{store.workspaceName}</span>
	</div>

	<nav class="flex-1 overflow-y-auto p-2">
		<a
			href="/"
			class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors
				{isActive('/')
				? 'bg-accent text-accent-foreground'
				: 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}"
		>
			<House class="size-4" />
			Home
		</a>

		<div class="text-muted-foreground mt-4 flex items-center justify-between px-2 py-1.5">
			<span class="text-xs font-medium tracking-wide uppercase">Projects</span>
			<button
				class="hover:text-foreground rounded p-0.5"
				aria-label="New project"
				onclick={() => (addingProject = true)}
			>
				<Plus class="size-4" />
			</button>
		</div>

		{#each store.projects as project (project.id)}
			<a
				href={`/projects/${project.id}`}
				class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors
					{isActive(`/projects/${project.id}`)
					? 'bg-accent text-accent-foreground'
					: 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}"
			>
				<span
					class="size-2.5 shrink-0 rounded-full"
					style={`background:${project.color ?? '#71717a'}`}
				></span>
				<span class="truncate">{project.name}</span>
			</a>
		{/each}

		{#if addingProject}
			<input
				bind:value={newProjectName}
				placeholder="Project name"
				use:focusOnMount
				onblur={submitNewProject}
				onkeydown={(e) => {
					if (e.key === 'Enter') submitNewProject();
					if (e.key === 'Escape') {
						newProjectName = '';
						addingProject = false;
					}
				}}
				class="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 mt-1 w-full rounded-md border px-2 py-1.5 text-sm outline-none focus-visible:ring-[2px]"
			/>
		{/if}

		{#if store.projects.length === 0 && !addingProject}
			<p class="text-muted-foreground px-2 py-2 text-xs">No projects yet.</p>
		{/if}
	</nav>
</aside>
