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
	import { getTracker, type Task } from '$lib/state/tracker.svelte';
	import Check from '@lucide/svelte/icons/check';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';

	let { task, onclose }: { task: Task | null; onclose: () => void } = $props();

	const store = getTracker();

	let dialog = $state<HTMLDialogElement | null>(null);
	let title = $state('');
	let description = $state('');
	let status = $state<TaskStatus>('backlog');
	let priority = $state<TaskPriority>('none');
	let dueDate = $state('');
	let newSubtask = $state('');
	let newLabel = $state('');

	// Live views from the store (react to Realtime + local mutations).
	const subtasks = $derived(task ? store.subtasksOf(task.id) : []);

	$effect(() => {
		if (task) {
			title = task.title;
			description = task.description ?? '';
			status = task.status;
			priority = task.priority;
			dueDate = task.dueDate ?? '';
			if (dialog && !dialog.open) dialog.showModal();
		} else if (dialog?.open) {
			dialog.close();
		}
	});

	function save() {
		if (!task) return;
		store.updateTask(task.id, {
			title: title.trim() || task.title,
			description: description.trim() ? description.trim() : null,
			status,
			priority,
			dueDate: dueDate ? dueDate : null
		});
		onclose();
	}

	function addSubtask() {
		if (!task || !newSubtask.trim()) return;
		store.createSubtask(task.id, task.projectId, newSubtask);
		newSubtask = '';
	}

	async function createAndApplyLabel() {
		if (!task || !newLabel.trim()) return;
		const id = await store.createLabel(newLabel);
		newLabel = '';
		if (id) store.toggleTaskLabel(task.id, id);
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
		<div class="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-5">
			<input bind:value={title} placeholder="Task title" class="{fieldClass} text-base font-medium" />

			<textarea
				bind:value={description}
				placeholder="Add a description…"
				rows="3"
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

			<label class="flex flex-col gap-1.5">
				<span class="text-muted-foreground text-xs font-medium">Due date</span>
				<input type="date" bind:value={dueDate} class={fieldClass} />
			</label>

			<!-- Labels -->
			<div class="flex flex-col gap-2">
				<span class="text-muted-foreground text-xs font-medium">Labels</span>
				<div class="flex flex-wrap gap-1.5">
					{#each store.labels as label (label.id)}
						{@const on = store.taskHasLabel(task.id, label.id)}
						<button
							type="button"
							onclick={() => task && store.toggleTaskLabel(task.id, label.id)}
							class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors"
							style={on
								? `color:${label.color ?? '#e4e4e7'};border-color:${label.color ?? '#a1a1aa'};background:color-mix(in srgb, ${label.color ?? '#a1a1aa'} 15%, transparent)`
								: ''}
							class:opacity-60={!on}
						>
							<span class="size-1.5 rounded-full" style={`background:${label.color ?? '#a1a1aa'}`}
							></span>
							{label.name}
							{#if on}<Check class="size-3" />{/if}
						</button>
					{/each}
				</div>
				<div class="flex items-center gap-2">
					<input
						bind:value={newLabel}
						placeholder="New label…"
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								createAndApplyLabel();
							}
						}}
						class="{fieldClass} py-1.5"
					/>
					<Button variant="outline" size="sm" onclick={createAndApplyLabel}>Add</Button>
				</div>
			</div>

			<!-- Subtasks -->
			<div class="flex flex-col gap-2">
				<span class="text-muted-foreground text-xs font-medium">
					Subtasks
					{#if subtasks.length > 0}
						<span class="ml-1">
							{subtasks.filter((s) => s.status === 'done').length}/{subtasks.length}
						</span>
					{/if}
				</span>
				{#each subtasks as sub (sub.id)}
					<div class="group/sub flex items-center gap-2">
						<button
							type="button"
							onclick={() => store.toggleSubtaskDone(sub.id, sub.status !== 'done')}
							class="border-input flex size-4 shrink-0 items-center justify-center rounded border {sub.status ===
							'done'
								? 'bg-primary text-primary-foreground border-primary'
								: ''}"
							aria-label="Toggle subtask"
						>
							{#if sub.status === 'done'}<Check class="size-3" />{/if}
						</button>
						<span class="min-w-0 flex-1 truncate text-sm {sub.status === 'done' ? 'text-muted-foreground line-through' : ''}">
							{sub.title}
						</span>
						<button
							type="button"
							onclick={() => store.deleteTask(sub.id)}
							class="text-muted-foreground hover:text-destructive opacity-0 group-hover/sub:opacity-100"
							aria-label="Delete subtask"
						>
							<X class="size-3.5" />
						</button>
					</div>
				{/each}
				<div class="flex items-center gap-2">
					<Plus class="text-muted-foreground size-4" />
					<input
						bind:value={newSubtask}
						placeholder="Add subtask…"
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								addSubtask();
							}
						}}
						class="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
					/>
				</div>
			</div>

			<div class="flex items-center justify-between border-t pt-3">
				<Button
					variant="ghost"
					size="sm"
					class="text-destructive hover:text-destructive"
					onclick={() => {
						if (task) store.deleteTask(task.id);
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
