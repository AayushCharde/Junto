<script lang="ts">
	import { getUi } from '$lib/state/ui.svelte';

	const ui = getUi();
	let dialog = $state<HTMLDialogElement | null>(null);

	$effect(() => {
		if (ui.shortcutsOpen) {
			if (dialog && !dialog.open) dialog.showModal();
		} else if (dialog?.open) {
			dialog.close();
		}
	});

	const groups: { title: string; items: { keys: string[]; label: string }[] }[] = [
		{
			title: 'General',
			items: [
				{ keys: ['⌘', 'K'], label: 'Open command palette' },
				{ keys: ['C'], label: 'New task' },
				{ keys: ['?'], label: 'This help' },
				{ keys: ['Esc'], label: 'Close dialog' }
			]
		},
		{
			title: 'Navigation & views',
			items: [
				{ keys: ['G', 'H'], label: 'Go to Home' },
				{ keys: ['B'], label: 'Board view' },
				{ keys: ['L'], label: 'List view' }
			]
		},
		{
			title: 'Composer',
			items: [{ keys: ['⌘', '↵'], label: 'Create task' }]
		}
	];
</script>

<dialog
	bind:this={dialog}
	onclose={() => (ui.shortcutsOpen = false)}
	onclick={(e) => {
		if (e.target === dialog) ui.shortcutsOpen = false;
	}}
	class="text-foreground bg-card border-border m-auto w-full max-w-md rounded-xl border p-0 shadow-2xl backdrop:bg-black/60"
>
	{#if ui.shortcutsOpen}
		<div class="p-5">
			<h2 class="mb-4 text-sm font-semibold">Keyboard shortcuts</h2>
			<div class="space-y-4">
				{#each groups as group (group.title)}
					<div>
						<h3 class="text-muted-foreground mb-2 text-[11px] font-medium tracking-wide uppercase">
							{group.title}
						</h3>
						<div class="space-y-1.5">
							{#each group.items as item (item.label)}
								<div class="flex items-center justify-between text-sm">
									<span>{item.label}</span>
									<span class="flex gap-1">
										{#each item.keys as key (key)}
											<kbd
												class="border-border bg-muted inline-flex min-w-5 items-center justify-center rounded border px-1.5 py-0.5 text-[11px]"
											>
												{key}
											</kbd>
										{/each}
									</span>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</dialog>
