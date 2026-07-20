<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { getTracker } from '$lib/state/tracker.svelte';
	import { getUi } from '$lib/state/ui.svelte';
	import Logo from '$lib/components/logo.svelte';
	import PaletteToggle from '$lib/components/palette-toggle.svelte';
	import House from '@lucide/svelte/icons/house';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';

	let { userEmail = null }: { userEmail?: string | null } = $props();

	const store = getTracker();
	const ui = getUi();

	const initials = $derived((userEmail ?? '?').slice(0, 2).toUpperCase());

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
		<Logo class="size-6 shrink-0" />
		<span class="truncate text-sm font-semibold tracking-tight">{store.workspaceName}</span>
	</div>

	<div class="flex items-center gap-1.5 p-2">
		<button
			onclick={() => ui.newTask({ projectId: store.projects[0]?.id ?? null })}
			class="bg-primary text-primary-foreground hover:bg-primary/90 flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors"
		>
			<Plus class="size-4" /> New task
		</button>
		<button
			onclick={() => ui.toggleCommand()}
			aria-label="Search (⌘K)"
			title="Search — ⌘K"
			class="text-muted-foreground hover:bg-accent/50 hover:text-foreground border-border flex items-center gap-1 rounded-md border px-2 py-1.5"
		>
			<Search class="size-4" />
			<kbd class="text-[10px]">⌘K</kbd>
		</button>
	</div>

	<nav class="flex-1 overflow-y-auto p-2 pt-0">
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
			{@const active = store.projectStats(project.id).active}
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
				<span class="min-w-0 flex-1 truncate">{project.name}</span>
				{#if active > 0}
					<span class="text-muted-foreground/80 shrink-0 text-xs tabular-nums">{active}</span>
				{/if}
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

	<div class="border-border space-y-2 border-t p-2">
		<div class="flex items-center justify-between px-1">
			<span class="text-muted-foreground text-xs font-medium">Theme</span>
			<PaletteToggle />
		</div>
		{#if userEmail}
			<div class="flex items-center gap-2">
				<div
					class="bg-accent text-accent-foreground grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold"
				>
					{initials}
				</div>
				<span class="text-muted-foreground min-w-0 flex-1 truncate text-xs" title={userEmail}>
					{userEmail}
				</span>
				<form method="POST" action="/auth/signout">
					<button
						class="text-muted-foreground hover:text-foreground rounded p-1.5"
						aria-label="Sign out"
						title="Sign out"
					>
						<LogOut class="size-4" />
					</button>
				</form>
			</div>
		{/if}
	</div>
</aside>
