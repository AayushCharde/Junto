<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import { getTracker, type Project } from '$lib/state/tracker.svelte';
	import { getUi } from '$lib/state/ui.svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Palette from '@lucide/svelte/icons/palette';
	import Archive from '@lucide/svelte/icons/archive';
	import ArchiveRestore from '@lucide/svelte/icons/archive-restore';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import FolderKanban from '@lucide/svelte/icons/folder-kanban';

	const store = getTracker();
	const ui = getUi();

	const COLORS = ['#6366f1', '#22d3ee', '#34d399', '#eab308', '#f97316', '#f43f5e', '#a855f7', '#64748b'];

	let adding = $state(false);
	let newName = $state('');
	let menuFor = $state<string | null>(null);
	let renamingId = $state<string | null>(null);
	let draftName = $state('');
	let coloringId = $state<string | null>(null);
	let showArchived = $state(false);
	let deleteTarget = $state<Project | null>(null);
	let confirmOpen = $state(false);

	function focusEl(node: HTMLElement) {
		node.focus();
	}

	async function createProject() {
		const n = newName.trim();
		newName = '';
		adding = false;
		if (n) await store.createProject(n);
	}
	function startRename(p: Project) {
		renamingId = p.id;
		draftName = p.name;
		menuFor = null;
	}
	function commitRename(p: Project) {
		const n = draftName.trim();
		renamingId = null;
		if (n && n !== p.name) store.updateProject(p.id, { name: n });
	}
	function requestDelete(p: Project) {
		deleteTarget = p;
		confirmOpen = true;
		menuFor = null;
	}
</script>

<svelte:head><title>Projects · Junto</title></svelte:head>

<header class="border-border flex h-12 shrink-0 items-center justify-between border-b px-5">
	<div class="flex items-center gap-2">
		<FolderKanban class="text-muted-foreground size-4" />
		<h1 class="text-sm font-semibold">Projects</h1>
		<span class="text-muted-foreground text-xs">{store.activeProjects.length}</span>
	</div>
	<Button size="sm" onclick={() => ((adding = true), (newName = ''))}>
		<Plus class="size-4" /> New project
	</Button>
</header>

<div class="flex-1 overflow-y-auto">
	<div class="mx-auto max-w-5xl space-y-6 p-6">
		{#if adding}
			<input
				bind:value={newName}
				use:focusEl
				placeholder="Project name…"
				onblur={createProject}
				onkeydown={(e) => {
					if (e.key === 'Enter') createProject();
					if (e.key === 'Escape') ((adding = false), (newName = ''));
				}}
				class="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full max-w-sm rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[2px]"
			/>
		{/if}

		{#if store.activeProjects.length === 0 && !adding}
			<div class="border-border text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed p-12 text-sm">
				<FolderKanban class="size-8 opacity-40" />
				No projects yet. Create your first.
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{#each store.activeProjects as project (project.id)}
					{@const stats = store.projectStats(project.id)}
					{@const pct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0}
					<div class="border-border bg-card relative rounded-xl border p-4">
						<div class="flex items-center gap-2">
							{#if coloringId === project.id}
								<div class="relative z-20 flex flex-wrap items-center gap-1.5">
									{#each COLORS as c (c)}
										<button
											type="button"
											aria-label="Set color"
											onclick={() => {
												store.updateProject(project.id, { color: c });
												coloringId = null;
											}}
											class="size-4 rounded-full ring-offset-1 ring-offset-card hover:ring-2 hover:ring-ring"
											style={`background:${c}`}
										></button>
									{/each}
								</div>
							{:else}
								<span class="size-2.5 shrink-0 rounded-full" style={`background:${project.color ?? '#71717a'}`}></span>
								{#if renamingId === project.id}
									<input
										bind:value={draftName}
										use:focusEl
										onblur={() => commitRename(project)}
										onkeydown={(e) => {
											if (e.key === 'Enter') e.currentTarget.blur();
											if (e.key === 'Escape') (renamingId = null);
										}}
										class="border-input bg-background min-w-0 flex-1 rounded border px-1.5 py-0.5 text-sm outline-none"
									/>
								{:else}
									<a href={`/projects/${project.id}`} class="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
										{project.name}
									</a>
								{/if}
							{/if}

							<button
								type="button"
								aria-label="Project actions"
								onclick={() => (menuFor = menuFor === project.id ? null : project.id)}
								class="text-muted-foreground hover:text-foreground hover:bg-accent ml-auto shrink-0 rounded p-1"
							>
								<Ellipsis class="size-4" />
							</button>

							{#if menuFor === project.id}
								<div class="border-border bg-popover absolute right-3 top-11 z-20 w-40 rounded-md border p-1 text-sm shadow-xl">
									<button type="button" class="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5" onclick={() => startRename(project)}>
										<Pencil class="size-3.5" /> Rename
									</button>
									<button type="button" class="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5" onclick={() => ((coloringId = project.id), (menuFor = null))}>
										<Palette class="size-3.5" /> Change color
									</button>
									<button type="button" class="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5" onclick={() => (store.updateProject(project.id, { archived: true }), (menuFor = null))}>
										<Archive class="size-3.5" /> Archive
									</button>
									<button type="button" class="text-destructive hover:bg-destructive/10 flex w-full items-center gap-2 rounded px-2 py-1.5" onclick={() => requestDelete(project)}>
										<Trash2 class="size-3.5" /> Delete
									</button>
								</div>
							{/if}
						</div>

						<div class="bg-muted mt-3 h-1.5 w-full overflow-hidden rounded-full">
							<div class="bg-primary h-full rounded-full" style={`width:${pct}%`}></div>
						</div>
						<div class="text-muted-foreground mt-2 flex items-center gap-4 text-xs">
							<span>{stats.total} total</span>
							<span>{stats.active} active</span>
							<span>{stats.done} done</span>
							<span class="ml-auto tabular-nums">{pct}%</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Archived -->
		{#if store.archivedProjects.length > 0}
			<div>
				<button
					type="button"
					onclick={() => (showArchived = !showArchived)}
					class="text-muted-foreground hover:text-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase"
				>
					<Archive class="size-3.5" /> Archived ({store.archivedProjects.length})
					<span>{showArchived ? '▾' : '▸'}</span>
				</button>
				{#if showArchived}
					<div class="mt-3 space-y-2">
						{#each store.archivedProjects as project (project.id)}
							<div class="border-border bg-card/50 flex items-center gap-2 rounded-lg border px-3 py-2">
								<span class="size-2.5 shrink-0 rounded-full opacity-60" style={`background:${project.color ?? '#71717a'}`}></span>
								<span class="text-muted-foreground min-w-0 flex-1 truncate text-sm">{project.name}</span>
								<button type="button" class="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs" onclick={() => store.updateProject(project.id, { archived: false })}>
									<ArchiveRestore class="size-3.5" /> Restore
								</button>
								<button type="button" class="text-muted-foreground hover:text-destructive flex items-center gap-1 text-xs" onclick={() => requestDelete(project)}>
									<Trash2 class="size-3.5" /> Delete
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<!-- Click-away to close an open card menu / color picker -->
{#if menuFor}
	<button type="button" aria-label="Close menu" class="fixed inset-0 z-10 cursor-default" onclick={() => (menuFor = null)}></button>
{/if}
{#if coloringId}
	<button type="button" aria-label="Close color picker" class="fixed inset-0 z-10 cursor-default" onclick={() => (coloringId = null)}></button>
{/if}

<ConfirmDialog
	bind:open={confirmOpen}
	title="Delete project?"
	message={deleteTarget ? `"${deleteTarget.name}" and all its tasks will be permanently deleted. This cannot be undone.` : ''}
	confirmLabel="Delete project"
	destructive
	onconfirm={() => {
		if (deleteTarget) store.deleteProject(deleteTarget.id);
		deleteTarget = null;
	}}
/>
