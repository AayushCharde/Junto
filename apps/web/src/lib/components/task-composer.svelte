<script lang="ts">
	import { untrack } from 'svelte';
	import {
		TASK_PRIORITIES,
		TASK_PRIORITY_LABELS,
		TASK_STATUSES,
		TASK_STATUS_LABELS,
		type TaskPriority,
		type TaskStatus
	} from '@junto/core';
	import { Button } from '$lib/components/ui/button';
	import StatusIcon from '$lib/components/status-icon.svelte';
	import PriorityIcon from '$lib/components/priority-icon.svelte';
	import { getTracker } from '$lib/state/tracker.svelte';
	import { getUi } from '$lib/state/ui.svelte';
	import { formatDue } from '$lib/due';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import Check from '@lucide/svelte/icons/check';
	import Tag from '@lucide/svelte/icons/tag';
	import X from '@lucide/svelte/icons/x';

	const store = getTracker();
	const ui = getUi();

	let dialog = $state<HTMLDialogElement | null>(null);
	let titleInput = $state<HTMLInputElement | null>(null);

	let projectId = $state('');
	let title = $state('');
	let description = $state('');
	let status = $state<TaskStatus>('backlog');
	let priority = $state<TaskPriority>('none');
	let dueDate = $state('');
	let labelIds = $state<string[]>([]);
	let createMore = $state(false);
	let saving = $state(false);

	// Which property popover is open (only one at a time).
	let menu = $state<'status' | 'priority' | 'labels' | null>(null);

	const project = $derived(store.projectById(projectId));

	function resetFields() {
		title = '';
		description = '';
		status = 'backlog';
		priority = 'none';
		dueDate = '';
		labelIds = [];
		menu = null;
	}

	// Open/close in response to the shared UI state. Only `ui.composer` is a
	// tracked dependency — the field seeding is untracked so a Realtime update
	// to store.projects can't re-run this and wipe what the user is typing.
	$effect(() => {
		const seed = ui.composer;
		if (seed) {
			untrack(() => {
				projectId = seed.projectId || store.projects[0]?.id || '';
				status = seed.status ?? 'backlog';
				description = '';
				title = '';
				priority = 'none';
				dueDate = '';
				labelIds = [];
				menu = null;
				if (dialog && !dialog.open) dialog.showModal();
				// Focus the title after the dialog paints.
				queueMicrotask(() => titleInput?.focus());
			});
		} else if (dialog?.open) {
			dialog.close();
		}
	});

	function close() {
		ui.closeComposer();
	}

	function toggleLabel(id: string) {
		labelIds = labelIds.includes(id) ? labelIds.filter((l) => l !== id) : [...labelIds, id];
	}

	async function create() {
		if (!projectId || !title.trim() || saving) return;
		saving = true;
		const id = await store.createDetailedTask({
			projectId,
			title,
			description,
			status,
			priority,
			dueDate,
			labelIds
		});
		saving = false;
		if (!id) return;
		if (createMore) {
			resetFields();
			queueMicrotask(() => titleInput?.focus());
		} else {
			close();
		}
	}

	const pill =
		'inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent/50 transition-colors outline-none focus-visible:ring-ring/50 focus-visible:ring-[2px]';
</script>

<dialog
	bind:this={dialog}
	onclose={close}
	onclick={(e) => {
		if (e.target === dialog) close();
	}}
	onkeydown={(e) => {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			create();
		}
	}}
	class="text-foreground bg-card border-border m-auto w-full max-w-2xl rounded-xl border p-0 shadow-2xl backdrop:bg-black/60"
>
	{#if ui.composer}
		<div class="flex flex-col">
			<!-- Header: project selector + "New task" -->
			<div class="border-border flex items-center gap-2 border-b px-4 py-2.5 text-xs">
				<select
					bind:value={projectId}
					class="border-border bg-accent/40 hover:bg-accent focus-visible:ring-ring/50 rounded-md border px-2 py-1 font-medium outline-none focus-visible:ring-[2px]"
				>
					{#each store.projects as p (p.id)}
						<option value={p.id}>{p.name}</option>
					{/each}
				</select>
				<span class="text-muted-foreground">›</span>
				<span class="text-muted-foreground">New task</span>
			</div>

			<!-- Title + description -->
			<div class="flex flex-col gap-1 px-4 pt-4">
				<input
					bind:this={titleInput}
					bind:value={title}
					placeholder="Task title"
					class="placeholder:text-muted-foreground w-full bg-transparent text-lg font-medium outline-none"
				/>
				<textarea
					bind:value={description}
					placeholder="Add description…"
					rows="3"
					class="placeholder:text-muted-foreground w-full resize-y bg-transparent text-sm outline-none"
				></textarea>
			</div>

			<!-- Property pills -->
			<div class="flex flex-wrap items-center gap-2 px-4 py-3">
				<!-- Status -->
				<div class="relative">
					<button type="button" class={pill} onclick={() => (menu = menu === 'status' ? null : 'status')}>
						<StatusIcon {status} class="size-3.5" />
						{TASK_STATUS_LABELS[status]}
					</button>
					{#if menu === 'status'}
						<div
							class="border-border bg-popover absolute z-10 mt-1 w-44 rounded-md border p-1 shadow-lg"
						>
							{#each TASK_STATUSES as s (s)}
								<button
									type="button"
									class="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
									onclick={() => {
										status = s;
										menu = null;
									}}
								>
									<StatusIcon status={s} class="size-3.5" />
									{TASK_STATUS_LABELS[s]}
									{#if s === status}<Check class="ml-auto size-3.5" />{/if}
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Priority -->
				<div class="relative">
					<button type="button" class={pill} onclick={() => (menu = menu === 'priority' ? null : 'priority')}>
						<PriorityIcon {priority} class="size-3.5" />
						{TASK_PRIORITY_LABELS[priority]}
					</button>
					{#if menu === 'priority'}
						<div
							class="border-border bg-popover absolute z-10 mt-1 w-44 rounded-md border p-1 shadow-lg"
						>
							{#each TASK_PRIORITIES as p (p)}
								<button
									type="button"
									class="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
									onclick={() => {
										priority = p;
										menu = null;
									}}
								>
									<PriorityIcon priority={p} class="size-3.5" />
									{TASK_PRIORITY_LABELS[p]}
									{#if p === priority}<Check class="ml-auto size-3.5" />{/if}
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Due date -->
				<label class={pill}>
					<CalendarDays class="size-3.5" />
					{#if dueDate}
						{formatDue(dueDate)}
					{:else}
						<span class="text-muted-foreground">Due date</span>
					{/if}
					<input type="date" bind:value={dueDate} class="w-0 opacity-0" />
				</label>
				{#if dueDate}
					<button
						type="button"
						class="text-muted-foreground hover:text-foreground -ml-1"
						aria-label="Clear due date"
						onclick={() => (dueDate = '')}
					>
						<X class="size-3.5" />
					</button>
				{/if}

				<!-- Labels -->
				<div class="relative">
					<button type="button" class={pill} onclick={() => (menu = menu === 'labels' ? null : 'labels')}>
						<Tag class="size-3.5" />
						{#if labelIds.length > 0}
							{labelIds.length} label{labelIds.length > 1 ? 's' : ''}
						{:else}
							<span class="text-muted-foreground">Labels</span>
						{/if}
					</button>
					{#if menu === 'labels'}
						<div
							class="border-border bg-popover absolute z-10 mt-1 max-h-56 w-52 overflow-y-auto rounded-md border p-1 shadow-lg"
						>
							{#if store.labels.length === 0}
								<p class="text-muted-foreground px-2 py-1.5 text-xs">No labels yet.</p>
							{/if}
							{#each store.labels as label (label.id)}
								{@const on = labelIds.includes(label.id)}
								<button
									type="button"
									class="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs"
									onclick={() => toggleLabel(label.id)}
								>
									<span class="size-2 rounded-full" style={`background:${label.color ?? '#a1a1aa'}`}></span>
									<span class="min-w-0 flex-1 truncate text-left">{label.name}</span>
									{#if on}<Check class="size-3.5" />{/if}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<!-- Footer -->
			<div class="border-border flex items-center justify-between border-t px-4 py-2.5">
				<label class="text-muted-foreground flex cursor-pointer items-center gap-2 text-xs">
					<input type="checkbox" bind:checked={createMore} class="accent-primary size-3.5" />
					Create more
				</label>
				<div class="flex items-center gap-2">
					<Button variant="ghost" size="sm" onclick={close}>Cancel</Button>
					<Button size="sm" onclick={create} disabled={!title.trim() || !projectId || saving}>
						Create task
						<kbd class="ml-1.5 text-[10px] opacity-70">⌘↵</kbd>
					</Button>
				</div>
			</div>
		</div>
	{/if}
</dialog>
