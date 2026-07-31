<script lang="ts">
	import { type Task } from '$lib/state/tracker.svelte';
	import TaskDetail from '$lib/components/task-detail.svelte';

	// Modal wrapper around the shared TaskDetail — used by board/home/mobile and
	// the command palette (via UiState.editingTaskId). The desktop Issues view
	// embeds TaskDetail directly in a pane instead.
	let { task, onclose }: { task: Task | null; onclose: () => void } = $props();

	let dialog = $state<HTMLDialogElement | null>(null);

	$effect(() => {
		if (task) {
			if (dialog && !dialog.open) dialog.showModal();
		} else if (dialog?.open) {
			dialog.close();
		}
	});
</script>

<dialog
	bind:this={dialog}
	onclose={onclose}
	onclick={(e) => {
		if (e.target === dialog) onclose();
	}}
	class="text-foreground bg-card border-border m-auto max-h-[85vh] w-full max-w-lg rounded-xl border p-0 shadow-2xl backdrop:bg-black/60"
>
	{#if task}
		<TaskDetail {task} {onclose} />
	{/if}
</dialog>
