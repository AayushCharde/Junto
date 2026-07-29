<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import PaletteToggle from '$lib/components/palette-toggle.svelte';
	import { getTracker, type Label } from '$lib/state/tracker.svelte';
	import Settings from '@lucide/svelte/icons/settings';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Plug from '@lucide/svelte/icons/plug';
	import LogOut from '@lucide/svelte/icons/log-out';

	const store = getTracker();
	const COLORS = ['#6366f1', '#22d3ee', '#34d399', '#eab308', '#f97316', '#f43f5e', '#a855f7', '#64748b'];

	let displayName = $state(store.currentUserName ?? '');
	let workspaceName = $state(store.workspaceName);

	// Labels
	let newLabelName = $state('');
	let newLabelColor = $state(COLORS[1]);
	let renamingId = $state<string | null>(null);
	let draftLabel = $state('');
	let coloringId = $state<string | null>(null);
	let deleteTarget = $state<Label | null>(null);
	let confirmOpen = $state(false);

	function focusEl(node: HTMLElement) {
		node.focus();
	}
	async function createLabel() {
		const n = newLabelName.trim();
		if (!n) return;
		newLabelName = '';
		await store.createLabel(n, newLabelColor);
	}
	function commitRename(l: Label) {
		const n = draftLabel.trim();
		renamingId = null;
		if (n && n !== l.name) store.updateLabel(l.id, { name: n });
	}

	const card = 'border-border bg-card rounded-xl border p-5';
	const field =
		'border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[2px]';
</script>

<svelte:head><title>Settings · Junto</title></svelte:head>

<header class="border-border flex h-12 shrink-0 items-center gap-2 border-b px-5">
	<Settings class="text-muted-foreground size-4" />
	<h1 class="text-sm font-semibold">Settings</h1>
</header>

<div class="flex-1 overflow-y-auto">
	<div class="mx-auto max-w-2xl space-y-6 p-6">
		<!-- Profile -->
		<section class={card}>
			<h2 class="text-sm font-semibold">Profile</h2>
			<p class="text-muted-foreground mt-0.5 text-xs">Your display name shows on comments, activity and assignments.</p>
			<div class="mt-4 flex items-end gap-2">
				<label class="flex flex-1 flex-col gap-1.5">
					<span class="text-xs font-medium">Display name</span>
					<input bind:value={displayName} placeholder="Your name" class={field} />
				</label>
				<Button size="sm" onclick={() => store.updateProfileName(displayName)}>Save</Button>
			</div>
		</section>

		<!-- Workspace -->
		<section class={card}>
			<h2 class="text-sm font-semibold">Workspace</h2>
			<div class="mt-4 flex items-end gap-2">
				<label class="flex flex-1 flex-col gap-1.5">
					<span class="text-xs font-medium">Workspace name</span>
					<input bind:value={workspaceName} class={field} />
				</label>
				<Button size="sm" onclick={() => store.updateWorkspaceName(workspaceName)}>Save</Button>
			</div>
		</section>

		<!-- Appearance -->
		<section class={card}>
			<h2 class="text-sm font-semibold">Appearance</h2>
			<div class="mt-3 flex items-center justify-between">
				<span class="text-muted-foreground text-sm">Color palette (Cyan / Graphite)</span>
				<PaletteToggle />
			</div>
		</section>

		<!-- Labels -->
		<section class={card}>
			<h2 class="text-sm font-semibold">Labels</h2>
			<p class="text-muted-foreground mt-0.5 text-xs">Reusable tags you can apply to any task.</p>

			<div class="mt-4 space-y-1.5">
				{#each store.labels as label (label.id)}
					<div class="group/l hover:bg-accent/30 flex items-center gap-2 rounded-md px-2 py-1.5">
						<div class="relative">
							<button
								type="button"
								aria-label="Change color"
								class="size-3.5 shrink-0 rounded-full"
								style={`background:${label.color ?? '#a1a1aa'}`}
								onclick={() => (coloringId = coloringId === label.id ? null : label.id)}
							></button>
							{#if coloringId === label.id}
								<div class="border-border bg-popover absolute left-0 top-6 z-20 flex gap-1.5 rounded-md border p-2 shadow-xl">
									{#each COLORS as c (c)}
										<button type="button" aria-label="color" class="size-4 rounded-full" style={`background:${c}`} onclick={() => (store.updateLabel(label.id, { color: c }), (coloringId = null))}></button>
									{/each}
								</div>
							{/if}
						</div>

						{#if renamingId === label.id}
							<input
								bind:value={draftLabel}
								use:focusEl
								onblur={() => commitRename(label)}
								onkeydown={(e) => {
									if (e.key === 'Enter') e.currentTarget.blur();
									if (e.key === 'Escape') (renamingId = null);
								}}
								class="border-input bg-background min-w-0 flex-1 rounded border px-1.5 py-0.5 text-sm outline-none"
							/>
						{:else}
							<button type="button" class="min-w-0 flex-1 truncate text-left text-sm" onclick={() => ((renamingId = label.id), (draftLabel = label.name))}>
								{label.name}
							</button>
						{/if}

						<button
							type="button"
							aria-label="Delete label"
							class="text-muted-foreground hover:text-destructive shrink-0 opacity-0 group-hover/l:opacity-100"
							onclick={() => ((deleteTarget = label), (confirmOpen = true))}
						>
							<Trash2 class="size-4" />
						</button>
					</div>
				{/each}
				{#if store.labels.length === 0}
					<p class="text-muted-foreground text-sm">No labels yet.</p>
				{/if}
			</div>

			<div class="mt-3 flex items-center gap-2">
				<div class="flex gap-1">
					{#each COLORS.slice(0, 6) as c (c)}
						<button
							type="button"
							aria-label="Pick color"
							class="size-4 rounded-full ring-offset-1 ring-offset-card {newLabelColor === c ? 'ring-2 ring-ring' : ''}"
							style={`background:${c}`}
							onclick={() => (newLabelColor = c)}
						></button>
					{/each}
				</div>
				<input
					bind:value={newLabelName}
					placeholder="New label…"
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							createLabel();
						}
					}}
					class="{field} flex-1 py-1.5"
				/>
				<Button variant="outline" size="sm" onclick={createLabel}><Plus class="size-4" /> Add</Button>
			</div>
		</section>

		<!-- Account -->
		<section class={card}>
			<h2 class="text-sm font-semibold">Account & integrations</h2>
			<div class="mt-3 space-y-3 text-sm">
				<a href="/mcp" class="text-muted-foreground hover:text-foreground flex items-center gap-2">
					<Plug class="size-4" /> Connect Claude & Cursor (MCP)
				</a>
				<form method="POST" action="/auth/signout">
					<button class="text-destructive hover:text-destructive/80 flex items-center gap-2">
						<LogOut class="size-4" /> Sign out
					</button>
				</form>
			</div>
		</section>
	</div>
</div>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Delete label?"
	message={deleteTarget ? `"${deleteTarget.name}" will be removed from all tasks.` : ''}
	confirmLabel="Delete label"
	destructive
	onconfirm={() => {
		if (deleteTarget) store.deleteLabel(deleteTarget.id);
		deleteTarget = null;
	}}
/>
