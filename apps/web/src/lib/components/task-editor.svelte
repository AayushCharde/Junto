<script lang="ts">
	import {
		TASK_PRIORITIES,
		TASK_PRIORITY_LABELS,
		TASK_STATUSES,
		TASK_STATUS_LABELS,
		type TaskPriority,
		type TaskStatus
	} from '@junto/core';
	import { Button } from '$lib/components/ui/button';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import type { Task } from '$lib/state/tracker.svelte';

	let {
		task,
		onclose,
		onsave,
		ondelete
	}: {
		task: Task | null;
		onclose: () => void;
		onsave: (
			id: string,
			patch: {
				title: string;
				description: string | null;
				status: TaskStatus;
				priority: TaskPriority;
			}
		) => void;
		ondelete: (id: string) => void;
	} = $props();

	let dialog = $state<HTMLDialogElement | null>(null);
	let title = $state('');
	let description = $state('');
	let status = $state<TaskStatus>('backlog');
	let priority = $state<TaskPriority>('none');

	$effect(() => {
		if (task) {
			title = task.title;
			description = task.description ?? '';
			status = task.status;
			priority = task.priority;
			if (dialog && !dialog.open) dialog.showModal();
		} else if (dialog?.open) {
			dialog.close();
		}
	});

	function save() {
		if (!task) return;
		onsave(task.id, {
			title: title.trim() || task.title,
			description: description.trim() ? description.trim() : null,
			status,
			priority
		});
		onclose();
	}

	const fieldClass =
		'border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[2px]';
</script>

<dialog
	bind:this={dialog}
	onclose={onclose}
	onclick={(e) => {
		if (e.target === dialog) onclose();
	}}
	class="text-foreground bg-card border-border m-auto w-full max-w-lg rounded-lg border p-0 shadow-xl backdrop:bg-black/60"
>
	{#if task}
		<div class="flex flex-col gap-4 p-5">
			<input
				bind:value={title}
				placeholder="Task title"
				class="{fieldClass} text-base font-medium"
			/>

			<textarea
				bind:value={description}
				placeholder="Add a description…"
				rows="4"
				class="{fieldClass} resize-y"
			></textarea>

			<div class="grid grid-cols-2 gap-3">
				<label class="flex flex-col gap-1.5">
					<span class="text-muted-foreground text-xs font-medium">Status</span>
					<select bind:value={status} class={fieldClass}>
						{#each TASK_STATUSES as s (s)}
							<option value={s}>{TASK_STATUS_LABELS[s]}</option>
						{/each}
					</select>
				</label>

				<label class="flex flex-col gap-1.5">
					<span class="text-muted-foreground text-xs font-medium">Priority</span>
					<select bind:value={priority} class={fieldClass}>
						{#each TASK_PRIORITIES as p (p)}
							<option value={p}>{TASK_PRIORITY_LABELS[p]}</option>
						{/each}
					</select>
				</label>
			</div>

			<div class="flex items-center justify-between pt-1">
				<Button
					variant="ghost"
					size="sm"
					class="text-destructive hover:text-destructive"
					onclick={() => {
						ondelete(task.id);
						onclose();
					}}
				>
					<Trash2 class="size-4" />
					Delete
				</Button>
				<div class="flex gap-2">
					<Button variant="outline" size="sm" onclick={onclose}>Cancel</Button>
					<Button size="sm" onclick={save}>Save</Button>
				</div>
			</div>
		</div>
	{/if}
</dialog>
