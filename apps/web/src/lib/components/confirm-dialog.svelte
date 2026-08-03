<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2026 Aayush Charde -->
<script lang="ts">
	import { Button } from '$lib/components/ui/button';

	let {
		open = $bindable(false),
		title = 'Are you sure?',
		message = '',
		confirmLabel = 'Confirm',
		destructive = false,
		onconfirm
	}: {
		open?: boolean;
		title?: string;
		message?: string;
		confirmLabel?: string;
		destructive?: boolean;
		onconfirm?: () => void;
	} = $props();

	let dialog = $state<HTMLDialogElement | null>(null);

	$effect(() => {
		if (open) {
			if (dialog && !dialog.open) dialog.showModal();
		} else if (dialog?.open) {
			dialog.close();
		}
	});

	function confirm() {
		onconfirm?.();
		open = false;
	}
</script>

<dialog
	bind:this={dialog}
	onclose={() => (open = false)}
	onclick={(e) => {
		if (e.target === dialog) open = false;
	}}
	class="text-foreground bg-card border-border m-auto w-full max-w-sm rounded-xl border p-0 shadow-2xl backdrop:bg-black/60"
>
	{#if open}
		<div class="p-5">
			<h2 class="text-base font-semibold">{title}</h2>
			{#if message}<p class="text-muted-foreground mt-1.5 text-sm leading-relaxed">{message}</p>{/if}
			<div class="mt-5 flex justify-end gap-2">
				<Button variant="outline" size="sm" onclick={() => (open = false)}>Cancel</Button>
				<Button
					size="sm"
					class={destructive ? 'bg-destructive text-white hover:bg-destructive/90' : ''}
					onclick={confirm}
				>
					{confirmLabel}
				</Button>
			</div>
		</div>
	{/if}
</dialog>
