<script lang="ts">
	import { tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { Component } from 'svelte';
	import { getTracker } from '$lib/state/tracker.svelte';
	import { getUi } from '$lib/state/ui.svelte';
	import StatusIcon from '$lib/components/status-icon.svelte';
	import PriorityIcon from '$lib/components/priority-icon.svelte';
	import House from '@lucide/svelte/icons/house';
	import Columns3 from '@lucide/svelte/icons/columns-3';
	import ListIcon from '@lucide/svelte/icons/list';
	import Palette from '@lucide/svelte/icons/palette';
	import Plus from '@lucide/svelte/icons/plus';
	import Keyboard from '@lucide/svelte/icons/keyboard';
	import LogOut from '@lucide/svelte/icons/log-out';
	import FolderKanban from '@lucide/svelte/icons/folder-kanban';
	import Search from '@lucide/svelte/icons/search';

	const store = getTracker();
	const ui = getUi();

	let dialog = $state<HTMLDialogElement | null>(null);
	let input = $state<HTMLInputElement | null>(null);
	let query = $state('');
	let selected = $state(0);

	const currentProjectId = $derived(page.params.projectId ?? null);

	type Item = {
		id: string;
		label: string;
		hint?: string;
		icon?: Component;
		swatch?: string;
		group: string;
		keywords?: string;
		run: () => void;
	};

	function switchPalette() {
		const next = document.documentElement.dataset.palette === 'graphite' ? 'cyan' : 'graphite';
		document.documentElement.dataset.palette = next;
		document.cookie = `palette=${next};path=/;max-age=31536000;samesite=lax`;
	}

	function signOut() {
		const form = document.createElement('form');
		form.method = 'POST';
		form.action = '/auth/signout';
		document.body.appendChild(form);
		form.submit();
	}

	// Static actions (always available).
	const actions = $derived<Item[]>([
		{
			id: 'new-task',
			label: 'New task',
			hint: 'C',
			icon: Plus,
			group: 'Actions',
			keywords: 'create add issue ticket',
			run: () => ui.newTask({ projectId: currentProjectId })
		},
		{ id: 'home', label: 'Go to Home', icon: House, group: 'Actions', keywords: 'dashboard', run: () => goto('/') },
		{
			id: 'view-board',
			label: 'Switch to Board view',
			hint: 'B',
			icon: Columns3,
			group: 'Actions',
			keywords: 'kanban columns',
			run: () => store.setView('board')
		},
		{
			id: 'view-list',
			label: 'Switch to List view',
			hint: 'L',
			icon: ListIcon,
			group: 'Actions',
			keywords: 'rows',
			run: () => store.setView('list')
		},
		{
			id: 'palette',
			label: 'Switch color palette',
			icon: Palette,
			group: 'Actions',
			keywords: 'theme cyan graphite color',
			run: switchPalette
		},
		{
			id: 'shortcuts',
			label: 'Keyboard shortcuts',
			hint: '?',
			icon: Keyboard,
			group: 'Actions',
			keywords: 'help keys',
			run: () => ui.toggleShortcuts()
		},
		{ id: 'signout', label: 'Sign out', icon: LogOut, group: 'Actions', keywords: 'logout exit', run: signOut }
	]);

	const projectItems = $derived<Item[]>(
		store.projects.map((p) => ({
			id: `project-${p.id}`,
			label: p.name,
			swatch: p.color ?? '#71717a',
			icon: FolderKanban,
			group: 'Projects',
			keywords: 'project',
			run: () => goto(`/projects/${p.id}`)
		}))
	);

	function matches(item: Item, q: string): boolean {
		const hay = `${item.label} ${item.keywords ?? ''}`.toLowerCase();
		return hay.includes(q);
	}

	// Task results only appear once the user types (there can be many).
	const taskItems = $derived.by<Item[]>(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		return store.tasks
			.filter((t) => t.parentTaskId === null && t.title.toLowerCase().includes(q))
			.slice(0, 8)
			.map((t) => {
				const project = store.projectById(t.projectId);
				return {
					id: `task-${t.id}`,
					label: t.title,
					hint: project?.name,
					group: 'Tasks',
					run: () => ui.openTask(t.id)
				};
			});
	});

	const results = $derived.by<Item[]>(() => {
		const q = query.trim().toLowerCase();
		const base = [...actions, ...projectItems].filter((i) => !q || matches(i, q));
		return [...base, ...taskItems];
	});

	// Keep the selection in range as results change.
	$effect(() => {
		if (selected >= results.length) selected = Math.max(0, results.length - 1);
	});

	// Group the flat result list for rendering while keeping a global index.
	const grouped = $derived.by(() => {
		const out: { group: string; items: { item: Item; index: number }[] }[] = [];
		results.forEach((item, index) => {
			let bucket = out.find((g) => g.group === item.group);
			if (!bucket) {
				bucket = { group: item.group, items: [] };
				out.push(bucket);
			}
			bucket.items.push({ item, index });
		});
		return out;
	});

	$effect(() => {
		if (ui.commandOpen) {
			query = '';
			selected = 0;
			if (dialog && !dialog.open) dialog.showModal();
			tick().then(() => input?.focus());
		} else if (dialog?.open) {
			dialog.close();
		}
	});

	function run(item: Item) {
		item.run();
		ui.closeCommand();
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selected = (selected + 1) % Math.max(1, results.length);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selected = (selected - 1 + results.length) % Math.max(1, results.length);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			const item = results[selected];
			if (item) run(item);
		}
	}
</script>

<dialog
	bind:this={dialog}
	onclose={() => ui.closeCommand()}
	onclick={(e) => {
		if (e.target === dialog) ui.closeCommand();
	}}
	class="text-foreground bg-card border-border mx-auto mt-[12vh] mb-auto w-full max-w-xl rounded-xl border p-0 shadow-2xl backdrop:bg-black/60"
>
	{#if ui.commandOpen}
		<div class="flex flex-col">
			<div class="border-border flex items-center gap-2 border-b px-3.5">
				<Search class="text-muted-foreground size-4 shrink-0" />
				<input
					bind:this={input}
					bind:value={query}
					{onkeydown}
					placeholder="Search tasks or run a command…"
					class="placeholder:text-muted-foreground w-full bg-transparent py-3 text-sm outline-none"
				/>
			</div>

			<div class="max-h-80 overflow-y-auto p-1.5">
				{#if results.length === 0}
					<p class="text-muted-foreground px-3 py-6 text-center text-sm">No results.</p>
				{/if}
				{#each grouped as group (group.group)}
					<div class="text-muted-foreground px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide uppercase">
						{group.group}
					</div>
					{#each group.items as { item, index } (item.id)}
						{@const Icon = item.icon}
						<button
							type="button"
							onclick={() => run(item)}
							onmousemove={() => (selected = index)}
							class="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm
								{index === selected ? 'bg-accent text-accent-foreground' : ''}"
						>
							{#if item.swatch}
								<span class="size-3 shrink-0 rounded-full" style={`background:${item.swatch}`}></span>
							{:else if Icon}
								<Icon class="text-muted-foreground size-4 shrink-0" />
							{/if}
							<span class="min-w-0 flex-1 truncate">{item.label}</span>
							{#if item.hint}
								<span class="text-muted-foreground shrink-0 text-xs">{item.hint}</span>
							{/if}
						</button>
					{/each}
				{/each}
			</div>
		</div>
	{/if}
</dialog>
