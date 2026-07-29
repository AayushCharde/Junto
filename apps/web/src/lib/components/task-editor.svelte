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
	import { describeActivity, formatRelative } from '$lib/activity';
	import { formatDue } from '$lib/due';
	import StatusIcon from '$lib/components/status-icon.svelte';
	import PriorityIcon from '$lib/components/priority-icon.svelte';
	import NameTag from '$lib/components/name-tag.svelte';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import Check from '@lucide/svelte/icons/check';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';

	let { task, onclose }: { task: Task | null; onclose: () => void } = $props();

	const store = getTracker();

	let dialog = $state<HTMLDialogElement | null>(null);
	let mode = $state<'view' | 'edit'>('view');
	let title = $state('');
	let description = $state('');
	let status = $state<TaskStatus>('backlog');
	let priority = $state<TaskPriority>('none');
	let dueDate = $state('');
	let assigneeId = $state<string | null>(null);
	let newSubtask = $state('');
	let newLabel = $state('');
	let newComment = $state('');

	const project = $derived(task ? store.projectById(task.projectId) : null);
	const subtasks = $derived(task ? store.subtasksOf(task.id) : []);
	const comments = $derived(task ? store.commentsForTask(task.id) : []);
	const activity = $derived(task ? store.activityForTask(task.id) : []);
	const taskLabels = $derived(task ? store.labelsForTask(task.id) : []);
	const assigneeName = $derived(task ? store.memberName(task.assigneeId) : null);
	const editing = $derived(mode === 'edit');

	function focus(node: HTMLElement) {
		node.focus();
	}
	function initials(name: string | null): string {
		const s = (name ?? '?').trim();
		return s ? s[0].toUpperCase() : '?';
	}

	function syncFromTask() {
		if (!task) return;
		title = task.title;
		description = task.description ?? '';
		status = task.status;
		priority = task.priority;
		dueDate = task.dueDate ?? '';
		assigneeId = task.assigneeId;
	}
	function startEdit() {
		syncFromTask(); // fresh buffer from the live task
		mode = 'edit';
	}

	// Open in read-only view. Only reset when a *different* task opens — not on
	// content updates (else an inline edit would kick you back to view mode).
	let lastId: string | null = null;
	$effect(() => {
		if (task) {
			if (task.id !== lastId) {
				lastId = task.id;
				syncFromTask();
				mode = 'view';
				if (dialog && !dialog.open) dialog.showModal();
			}
		} else {
			lastId = null;
			if (dialog?.open) dialog.close();
		}
	});

	// Inline commits — only reachable in edit mode.
	function commitTitle() {
		if (!task) return;
		const t = title.trim();
		if (t && t !== task.title) store.updateTask(task.id, { title: t });
		else title = task.title;
	}
	function commitDesc() {
		if (!task) return;
		const d = description.trim() ? description.trim() : null;
		if (d !== (task.description ?? null)) store.updateTask(task.id, { description: d });
	}
	function commitStatus() {
		if (task) store.updateTask(task.id, { status });
	}
	function commitPriority() {
		if (task) store.updateTask(task.id, { priority });
	}
	function commitDue() {
		if (task) store.updateTask(task.id, { dueDate: dueDate ? dueDate : null });
	}
	function commitAssignee() {
		if (task) store.assignTask(task.id, assigneeId || null);
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
	function addComment() {
		if (!task || !newComment.trim()) return;
		store.addComment(task.id, newComment);
		newComment = '';
	}

	const badge =
		'relative inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm';
	const badgeEdit = badge + ' hover:bg-accent/40 transition-colors';
	const fieldClass =
		'border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[2px]';
</script>

<dialog
	bind:this={dialog}
	onclose={onclose}
	onclick={(e) => {
		if (e.target === dialog) onclose();
	}}
	class="text-foreground bg-card border-border m-auto w-full max-w-lg rounded-xl border p-0 shadow-2xl backdrop:bg-black/60"
>
	{#if task}
		<!-- Header -->
		<div class="border-border flex items-center justify-between gap-2 border-b px-5 py-2.5">
			<a
				href={`/projects/${task.projectId}`}
				class="text-muted-foreground hover:text-foreground flex min-w-0 items-center gap-1.5 text-xs"
			>
				<span class="size-2 shrink-0 rounded-full" style={`background:${project?.color ?? '#71717a'}`}></span>
				<span class="truncate">{project?.name ?? 'Project'}</span>
			</a>
			<div class="flex shrink-0 items-center gap-1.5">
				{#if editing}
					<Button size="sm" onclick={() => (mode = 'view')}>Done</Button>
				{:else}
					<Button variant="outline" size="sm" onclick={startEdit}>
						<Pencil class="size-3.5" /> Edit
					</Button>
				{/if}
				<button
					type="button"
					onclick={onclose}
					class="text-muted-foreground hover:text-foreground rounded p-1"
					aria-label="Close"
				>
					<X class="size-4" />
				</button>
			</div>
		</div>

		<div class="flex max-h-[80vh] flex-col gap-4 overflow-y-auto p-5">
			<!-- Title -->
			{#if editing}
				<input
					bind:value={title}
					onblur={commitTitle}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							e.currentTarget.blur();
						}
					}}
					placeholder="Task title"
					class="placeholder:text-muted-foreground w-full bg-transparent text-lg font-semibold outline-none"
				/>
			{:else}
				<h2 class="text-lg font-semibold break-words">{task.title}</h2>
			{/if}

			<!-- Property badges -->
			<div class="flex flex-wrap items-center gap-2">
				{#if editing}
					<span class={badgeEdit}>
						<StatusIcon {status} class="size-3.5" />
						{TASK_STATUS_LABELS[status]}
						<select bind:value={status} onchange={commitStatus} aria-label="Status" class="absolute inset-0 cursor-pointer opacity-0">
							{#each TASK_STATUSES as s (s)}<option value={s}>{TASK_STATUS_LABELS[s]}</option>{/each}
						</select>
					</span>
					<span class={badgeEdit}>
						<PriorityIcon {priority} class="size-3.5" />
						{TASK_PRIORITY_LABELS[priority]}
						<select bind:value={priority} onchange={commitPriority} aria-label="Priority" class="absolute inset-0 cursor-pointer opacity-0">
							{#each TASK_PRIORITIES as p (p)}<option value={p}>{TASK_PRIORITY_LABELS[p]}</option>{/each}
						</select>
					</span>
					<span class={badgeEdit}>
						<CalendarDays class="size-3.5" />
						{#if dueDate}{formatDue(dueDate)}{:else}<span class="text-muted-foreground">Due date</span>{/if}
						<input type="date" bind:value={dueDate} onchange={commitDue} aria-label="Due date" class="absolute inset-0 cursor-pointer opacity-0" />
					</span>
					<span class={badgeEdit}>
						<NameTag name={store.memberName(assigneeId)} showName={!!assigneeId} />
						{#if !assigneeId}<span class="text-muted-foreground">Assignee</span>{/if}
						<select bind:value={assigneeId} onchange={commitAssignee} aria-label="Assignee" class="absolute inset-0 cursor-pointer opacity-0">
							<option value="">Unassigned</option>
							{#each store.members as m (m.id)}<option value={m.id}>{m.name}</option>{/each}
						</select>
					</span>
				{:else}
					<span class={badge}><StatusIcon status={task.status} class="size-3.5" /> {TASK_STATUS_LABELS[task.status]}</span>
					<span class={badge}><PriorityIcon priority={task.priority} class="size-3.5" /> {TASK_PRIORITY_LABELS[task.priority]}</span>
					<span class={badge}>
						<CalendarDays class="size-3.5" />
						{#if task.dueDate}{formatDue(task.dueDate)}{:else}<span class="text-muted-foreground">No due date</span>{/if}
					</span>
					<span class={badge}><NameTag name={assigneeName} /></span>
				{/if}
			</div>

			<!-- Description -->
			{#if editing}
				<textarea
					bind:value={description}
					onblur={commitDesc}
					placeholder="Add a description…"
					rows="4"
					class="{fieldClass} resize-y"
				></textarea>
			{:else if task.description}
				<p class="text-sm break-words whitespace-pre-wrap">{task.description}</p>
			{:else}
				<p class="text-muted-foreground text-sm italic">No description</p>
			{/if}

			<!-- Labels -->
			<div class="flex flex-col gap-2 border-t pt-3">
				<span class="text-muted-foreground text-xs font-medium">Labels</span>
				{#if editing}
					<div class="flex flex-wrap gap-1.5">
						{#each store.labels as label (label.id)}
							{@const on = store.taskHasLabel(task.id, label.id)}
							<button
								type="button"
								onclick={() => task && store.toggleTaskLabel(task.id, label.id)}
								class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors"
								style={on ? `color:${label.color ?? '#e4e4e7'};border-color:${label.color ?? '#a1a1aa'};background:color-mix(in srgb, ${label.color ?? '#a1a1aa'} 15%, transparent)` : ''}
								class:opacity-60={!on}
							>
								<span class="size-1.5 rounded-full" style={`background:${label.color ?? '#a1a1aa'}`}></span>
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
				{:else if taskLabels.length > 0}
					<div class="flex flex-wrap gap-1.5">
						{#each taskLabels as label (label.id)}
							<span
								class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
								style={`color:${label.color ?? '#a1a1aa'};background:color-mix(in srgb, ${label.color ?? '#a1a1aa'} 16%, transparent)`}
							>
								{label.name}
							</span>
						{/each}
					</div>
				{:else}
					<span class="text-muted-foreground text-sm">None</span>
				{/if}
			</div>

			<!-- Subtasks -->
			<div class="flex flex-col gap-2 border-t pt-3">
				<span class="text-muted-foreground text-xs font-medium">
					Subtasks
					{#if subtasks.length > 0}
						<span class="ml-1">{subtasks.filter((s) => s.status === 'done').length}/{subtasks.length}</span>
					{/if}
				</span>
				{#each subtasks as sub (sub.id)}
					<div class="group/sub flex items-center gap-2">
						<button
							type="button"
							disabled={!editing}
							onclick={() => store.toggleSubtaskDone(sub.id, sub.status !== 'done')}
							class="border-input flex size-4 shrink-0 items-center justify-center rounded border disabled:opacity-60 {sub.status === 'done' ? 'bg-primary text-primary-foreground border-primary' : ''}"
							aria-label="Toggle subtask"
						>
							{#if sub.status === 'done'}<Check class="size-3" />{/if}
						</button>
						<span class="min-w-0 flex-1 truncate text-sm {sub.status === 'done' ? 'text-muted-foreground line-through' : ''}">{sub.title}</span>
						{#if editing}
							<button type="button" onclick={() => store.deleteTask(sub.id)} class="text-muted-foreground hover:text-destructive opacity-0 group-hover/sub:opacity-100" aria-label="Delete subtask">
								<X class="size-3.5" />
							</button>
						{/if}
					</div>
				{/each}
				{#if editing}
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
				{:else if subtasks.length === 0}
					<span class="text-muted-foreground text-sm">None</span>
				{/if}
			</div>

			<!-- Comments (always available) -->
			<div class="flex flex-col gap-2 border-t pt-3">
				<span class="text-muted-foreground text-xs font-medium">
					Comments
					{#if comments.length > 0}<span class="ml-1">{comments.length}</span>{/if}
				</span>
				{#each comments as comment (comment.id)}
					<div class="group/comment flex items-start gap-2">
						<span class="bg-muted text-muted-foreground mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
							{initials(comment.authorName)}
						</span>
						<div class="min-w-0 flex-1">
							<div class="flex items-baseline gap-2">
								<span class="truncate text-xs font-medium">{comment.authorName ?? 'Someone'}</span>
								<span class="text-muted-foreground shrink-0 text-xs">{formatRelative(comment.createdAt)}</span>
							</div>
							<p class="text-sm break-words whitespace-pre-wrap">{comment.body}</p>
						</div>
						<button type="button" onclick={() => store.deleteComment(comment.id)} class="text-muted-foreground hover:text-destructive mt-0.5 opacity-0 group-hover/comment:opacity-100" aria-label="Delete comment">
							<X class="size-3.5" />
						</button>
					</div>
				{/each}
				<div class="flex items-start gap-2">
					<textarea
						bind:value={newComment}
						placeholder="Write a comment…  (⌘/Ctrl+Enter to send)"
						rows="2"
						onkeydown={(e) => {
							if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
								e.preventDefault();
								addComment();
							}
						}}
						class="{fieldClass} resize-y py-1.5"
					></textarea>
					<Button variant="outline" size="sm" onclick={addComment}>Send</Button>
				</div>
			</div>

			<!-- Activity -->
			{#if activity.length > 0}
				<div class="flex flex-col gap-2 border-t pt-3">
					<span class="text-muted-foreground text-xs font-medium">Activity</span>
					{#each activity as item (item.id)}
						<div class="text-muted-foreground flex items-center gap-2 text-xs">
							<span class="bg-border size-1.5 shrink-0 rounded-full"></span>
							<span class="text-foreground/80 font-medium">{item.actorName ?? 'Someone'}</span>
							<span>{describeActivity(item)}</span>
							<span class="ml-auto shrink-0">{formatRelative(item.createdAt)}</span>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Delete (edit mode only) -->
			{#if editing}
				<div class="flex border-t pt-3">
					<Button
						variant="ghost"
						size="sm"
						class="text-destructive hover:text-destructive"
						onclick={() => {
							if (task) store.deleteTask(task.id);
							onclose();
						}}
					>
						<Trash2 class="size-4" /> Delete task
					</Button>
				</div>
			{/if}
		</div>
	{/if}
</dialog>
