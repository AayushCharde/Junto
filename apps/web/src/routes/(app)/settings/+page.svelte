<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte';
	import PaletteToggle from '$lib/components/palette-toggle.svelte';
	import NameTag from '$lib/components/name-tag.svelte';
	import { getTracker, type Label, type Member } from '$lib/state/tracker.svelte';
	import Settings from '@lucide/svelte/icons/settings';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Plug from '@lucide/svelte/icons/plug';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Users from '@lucide/svelte/icons/users';
	import Copy from '@lucide/svelte/icons/copy';
	import Check from '@lucide/svelte/icons/check';

	const store = getTracker();

	// ── Members & invites ──────────────────────────────────────────────
	type Invite = {
		id: string;
		token: string;
		role: string;
		createdAt: string;
		expiresAt: string | null;
		acceptedAt: string | null;
	};
	let invites = $state<Invite[]>([]);
	let creatingInvite = $state(false);
	let copiedId = $state<string | null>(null);
	let memberToRemove = $state<Member | null>(null);
	let removeMemberOpen = $state(false);

	const inviteUrl = (token: string) => `${page.url.origin}/invite/${token}`;
	const roleLabel = (m: Member) => (m.isOwner ? 'Owner' : m.role.charAt(0).toUpperCase() + m.role.slice(1));

	onMount(() => {
		if (store.isOwner && store.workspaceId) loadInvites();
	});

	async function loadInvites() {
		const res = await fetch(`/api/workspace/${store.workspaceId}/invites`);
		if (res.ok) invites = await res.json();
	}
	async function createInvite() {
		if (!store.workspaceId || creatingInvite) return;
		creatingInvite = true;
		try {
			const res = await fetch(`/api/workspace/${store.workspaceId}/invites`, { method: 'POST' });
			if (res.ok) invites = [await res.json(), ...invites];
		} finally {
			creatingInvite = false;
		}
	}
	async function revokeInvite(id: string) {
		const prev = invites;
		invites = invites.filter((i) => i.id !== id);
		const res = await fetch(`/api/workspace/${store.workspaceId}/invites/${id}`, { method: 'DELETE' });
		if (!res.ok) invites = prev;
	}
	async function copyInvite(inv: Invite) {
		try {
			await navigator.clipboard.writeText(inviteUrl(inv.token));
			copiedId = inv.id;
			setTimeout(() => (copiedId = copiedId === inv.id ? null : copiedId), 1500);
		} catch {
			/* clipboard blocked; ignore */
		}
	}
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

		<!-- Members -->
		<section class={card}>
			<div class="flex items-center gap-2">
				<Users class="text-muted-foreground size-4" />
				<h2 class="text-sm font-semibold">Members</h2>
			</div>
			<p class="text-muted-foreground mt-0.5 text-xs">
				{store.isOwner
					? 'People with access to this workspace. Share an invite link to add teammates.'
					: 'People with access to this workspace.'}
			</p>

			<div class="mt-4 space-y-1">
				{#each store.members as m (m.id)}
					<div class="hover:bg-accent/30 flex items-center gap-2.5 rounded-md px-2 py-1.5">
						<NameTag name={store.memberName(m.id)} showName={false} />
						<span class="min-w-0 flex-1 truncate text-sm">
							{store.memberName(m.id) ?? 'Member'}
							{#if m.id === store.currentUserId}<span class="text-muted-foreground">(you)</span>{/if}
						</span>
						<span class="text-muted-foreground border-border rounded-full border px-2 py-0.5 text-[11px]">
							{roleLabel(m)}
						</span>
						{#if store.isOwner && !m.isOwner}
							<button
								type="button"
								aria-label="Remove member"
								class="text-muted-foreground hover:text-destructive shrink-0"
								onclick={() => ((memberToRemove = m), (removeMemberOpen = true))}
							>
								<Trash2 class="size-4" />
							</button>
						{/if}
					</div>
				{/each}
			</div>

			{#if store.isOwner}
				<div class="border-border mt-4 border-t pt-4">
					<div class="flex items-center justify-between">
						<div>
							<h3 class="text-sm font-medium">Invite links</h3>
							<p class="text-muted-foreground text-xs">Anyone with a link can join as a member.</p>
						</div>
						<Button variant="outline" size="sm" onclick={createInvite} disabled={creatingInvite}>
							<Plus class="size-4" /> Create link
						</Button>
					</div>

					{#if invites.length > 0}
						<div class="mt-3 space-y-1.5">
							{#each invites as inv (inv.id)}
								<div class="border-border bg-background flex items-center gap-2 rounded-md border px-2 py-1.5">
									<code class="min-w-0 flex-1 truncate font-mono text-xs">{inviteUrl(inv.token)}</code>
									<button
										type="button"
										aria-label="Copy invite link"
										class="text-muted-foreground hover:text-foreground shrink-0"
										onclick={() => copyInvite(inv)}
									>
										{#if copiedId === inv.id}<Check class="size-4 text-green-500" />{:else}<Copy class="size-4" />{/if}
									</button>
									<button
										type="button"
										aria-label="Revoke invite link"
										class="text-muted-foreground hover:text-destructive shrink-0"
										onclick={() => revokeInvite(inv.id)}
									>
										<Trash2 class="size-4" />
									</button>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-muted-foreground mt-3 text-sm">No invite links yet.</p>
					{/if}
				</div>
			{/if}
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

<!-- Click-away to dismiss the label color picker -->
{#if coloringId}
	<button type="button" aria-label="Close color picker" class="fixed inset-0 z-10 cursor-default" onclick={() => (coloringId = null)}></button>
{/if}

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

<ConfirmDialog
	bind:open={removeMemberOpen}
	title="Remove member?"
	message={memberToRemove
		? `${store.memberName(memberToRemove.id) ?? 'This member'} will lose access to this workspace.`
		: ''}
	confirmLabel="Remove member"
	destructive
	onconfirm={() => {
		if (memberToRemove) store.removeMember(memberToRemove.id);
		memberToRemove = null;
	}}
/>
