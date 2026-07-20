<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import Mail from '@lucide/svelte/icons/mail';
	import Command from '@lucide/svelte/icons/command';
	import LayoutList from '@lucide/svelte/icons/layout-list';
	import Bot from '@lucide/svelte/icons/bot';
	import Search from '@lucide/svelte/icons/search';
	import Plus from '@lucide/svelte/icons/plus';
	import Columns3 from '@lucide/svelte/icons/columns-3';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let submitting = $state(false);

	const signedOut = $derived(page.url.searchParams.get('signedout') !== null);

	const features = [
		{ icon: Command, label: '⌘K command palette & keyboard shortcuts' },
		{ icon: LayoutList, label: 'Boards, lists, subtasks, labels & due dates' },
		{ icon: Bot, label: 'Create and manage tasks right from Claude' }
	];

	const chips = ['⌘K palette', 'Board & List', 'Realtime sync', 'Labels & filters', 'MCP for Claude'];
</script>

<svelte:head><title>Sign in · Junto</title></svelte:head>

<div class="bg-background text-foreground grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
	<!-- ── Brand panel ─────────────────────────────────────────────── -->
	<aside class="brand relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
		<!-- ambient background layers -->
		<div class="layer grid-layer" aria-hidden="true"></div>
		<div class="layer orb orb-a" aria-hidden="true"></div>
		<div class="layer orb orb-b" aria-hidden="true"></div>
		<div class="layer vignette" aria-hidden="true"></div>

		<!-- top: wordmark + badge -->
		<div class="relative z-10 flex items-center justify-between">
			<div class="flex items-center gap-2.5">
				<div class="logo-mark">J</div>
				<span class="text-lg font-semibold tracking-tight">Junto</span>
			</div>
			<span class="badge">100% open source</span>
		</div>

		<!-- middle: headline + signature ⌘K palette mock -->
		<div class="relative z-10 max-w-md">
			<h2 class="headline">
				Your work,<br /><span class="grad-text">one keystroke</span> away.
			</h2>
			<p class="text-muted-foreground mt-4 text-[15px] leading-relaxed">
				A keyboard-first task tracker — capture, organize and ship without lifting your hands off
				the keys.
			</p>

			<!-- floating command-palette preview -->
			<div class="palette" aria-hidden="true">
				<div class="palette-search">
					<Search class="size-4 opacity-60" />
					<span>Create task, jump to project…</span>
					<kbd class="kbd">⌘K</kbd>
				</div>
				<div class="palette-row is-active">
					<Plus class="size-4" /> New task <span class="row-hint">C</span>
				</div>
				<div class="palette-row">
					<Columns3 class="size-4" /> Switch to Board view <span class="row-hint">B</span>
				</div>
				<div class="palette-row">
					<Bot class="size-4" /> Ask Claude to plan my week
				</div>
			</div>

			<ul class="mt-8 space-y-3">
				{#each features as feature (feature.label)}
					{@const Icon = feature.icon}
					<li class="flex items-center gap-3">
						<span class="feat-ico"><Icon class="size-4" /></span>
						<span class="text-foreground/85 text-sm">{feature.label}</span>
					</li>
				{/each}
			</ul>
		</div>

		<!-- bottom: capability chips -->
		<div class="relative z-10 flex flex-wrap gap-2">
			{#each chips as chip (chip)}
				<span class="chip">{chip}</span>
			{/each}
		</div>
	</aside>

	<!-- ── Form panel ──────────────────────────────────────────────── -->
	<main class="flex items-center justify-center px-6 py-12">
		<div class="w-full max-w-sm">
			<div class="mb-8 flex items-center gap-2 lg:hidden">
				<div class="logo-mark size-6 text-sm">J</div>
				<span class="text-lg font-semibold tracking-tight">Junto</span>
			</div>

			{#if form?.success}
				<div class="border-border bg-card rounded-xl border p-6 text-center">
					<div class="bg-primary/10 mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
						<Mail class="text-primary size-6" />
					</div>
					<h1 class="text-lg font-semibold tracking-tight">Check your email</h1>
					<p class="text-muted-foreground mt-2 text-sm leading-relaxed">
						We sent a magic link to <span class="text-foreground font-medium">{form.email}</span>.
						Open it on this device to sign in.
					</p>
				</div>
			{:else}
				{#if signedOut}
					<div
						class="border-border bg-card text-muted-foreground mb-5 rounded-lg border px-3.5 py-2.5 text-sm"
					>
						You've been signed out. See you soon.
					</div>
				{/if}

				<h1 class="text-2xl font-semibold tracking-tight">Sign in to Junto</h1>
				<p class="text-muted-foreground mt-2 text-sm">
					Enter your email and we'll send you a magic link — no password needed.
				</p>

				<form
					method="POST"
					use:enhance={() => {
						submitting = true;
						return async ({ update }) => {
							await update();
							submitting = false;
						};
					}}
					class="mt-6 space-y-3"
				>
					<input
						type="email"
						name="email"
						required
						autocomplete="email"
						placeholder="you@example.com"
						value={form?.email ?? ''}
						class="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-11 w-full rounded-lg border px-3.5 text-sm outline-none focus-visible:ring-[2px]"
					/>

					<label class="text-muted-foreground flex cursor-pointer items-center gap-2 text-sm select-none">
						<input
							type="checkbox"
							name="remember"
							checked
							class="accent-primary size-4 rounded"
						/>
						Keep me signed in on this device
					</label>

					{#if form?.message}
						<p class="text-destructive text-sm">{form.message}</p>
					{/if}

					<Button type="submit" class="h-11 w-full" disabled={submitting}>
						{#if submitting}
							Sending…
						{:else}
							<Mail class="size-4" /> Send magic link
						{/if}
					</Button>
				</form>

				<p class="text-muted-foreground/70 mt-4 text-xs leading-relaxed">
					By continuing you agree to keep your tasks tidy. The link signs you in on this device.
				</p>
			{/if}
		</div>
	</main>
</div>

<style>
	/* ── Brand panel: layered ambient identity ─────────────────────── */
	.brand {
		background: radial-gradient(140% 120% at 0% 0%, #0f1720, #08080b 60%);
		border-right: 1px solid var(--border);
	}
	.layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	/* fine grid, faded out toward the edges */
	.grid-layer {
		background-image:
			linear-gradient(color-mix(in srgb, var(--primary) 9%, transparent) 1px, transparent 1px),
			linear-gradient(90deg, color-mix(in srgb, var(--primary) 9%, transparent) 1px, transparent 1px);
		background-size: 40px 40px;
		-webkit-mask-image: radial-gradient(90% 80% at 30% 20%, #000 30%, transparent 78%);
		mask-image: radial-gradient(90% 80% at 30% 20%, #000 30%, transparent 78%);
		opacity: 0.7;
	}
	/* soft colored glow orbs */
	.orb {
		width: 34rem;
		height: 34rem;
		border-radius: 50%;
		filter: blur(70px);
		opacity: 0.5;
	}
	.orb-a {
		top: -12rem;
		left: -10rem;
		background: radial-gradient(circle, color-mix(in srgb, var(--primary) 70%, transparent), transparent 65%);
		animation: drift-a 20s ease-in-out infinite alternate;
	}
	.orb-b {
		right: -12rem;
		bottom: -14rem;
		background: radial-gradient(circle, rgba(59, 130, 246, 0.65), transparent 65%);
		animation: drift-b 24s ease-in-out infinite alternate;
	}
	.vignette {
		background: linear-gradient(to top, rgba(0, 0, 0, 0.45), transparent 40%);
	}
	@keyframes drift-a {
		to {
			transform: translate3d(4rem, 3rem, 0) scale(1.12);
		}
	}
	@keyframes drift-b {
		to {
			transform: translate3d(-3rem, -2rem, 0) scale(1.1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.orb {
			animation: none;
		}
	}

	.logo-mark {
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 0.5rem;
		display: grid;
		place-items: center;
		font-weight: 800;
		color: #04140d;
		background: linear-gradient(135deg, #34d399, var(--primary) 45%, #3b82f6);
		box-shadow: 0 0 24px -4px color-mix(in srgb, var(--primary) 70%, transparent);
	}

	.badge {
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--muted-foreground);
		border: 1px solid var(--border);
		background: color-mix(in srgb, var(--card) 60%, transparent);
		padding: 4px 10px;
		border-radius: 999px;
		backdrop-filter: blur(6px);
	}

	.headline {
		font-size: clamp(2.1rem, 3.4vw, 2.9rem);
		font-weight: 640;
		line-height: 1.04;
		letter-spacing: -0.03em;
		text-wrap: balance;
	}
	.grad-text {
		background: linear-gradient(100deg, #34d399, #22d3ee 45%, #3b82f6);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}

	/* signature command-palette preview */
	.palette {
		margin-top: 1.75rem;
		border: 1px solid var(--border);
		border-radius: 0.875rem;
		background: color-mix(in srgb, var(--card) 82%, transparent);
		box-shadow: 0 24px 60px -30px rgba(0, 0, 0, 0.9);
		backdrop-filter: blur(10px);
		overflow: hidden;
		max-width: 22rem;
	}
	.palette-search {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.7rem 0.85rem;
		border-bottom: 1px solid var(--border);
		font-size: 13px;
		color: var(--muted-foreground);
	}
	.kbd {
		margin-left: auto;
		font-size: 10px;
		border: 1px solid var(--border);
		border-radius: 5px;
		padding: 1px 6px;
		color: var(--muted-foreground);
	}
	.palette-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.85rem;
		font-size: 13px;
		color: color-mix(in srgb, var(--foreground) 82%, transparent);
	}
	.palette-row :global(svg) {
		color: var(--muted-foreground);
	}
	.palette-row.is-active {
		background: color-mix(in srgb, var(--primary) 15%, transparent);
		color: var(--foreground);
	}
	.palette-row.is-active :global(svg) {
		color: var(--primary);
	}
	.row-hint {
		margin-left: auto;
		font-size: 10px;
		color: var(--muted-foreground);
	}

	.feat-ico {
		display: grid;
		place-items: center;
		width: 2rem;
		height: 2rem;
		flex: none;
		border-radius: 0.5rem;
		border: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
		background: color-mix(in srgb, var(--card) 40%, transparent);
		color: var(--primary);
		backdrop-filter: blur(4px);
	}

	.chip {
		font-size: 11.5px;
		color: var(--muted-foreground);
		border: 1px solid var(--border);
		background: color-mix(in srgb, var(--card) 45%, transparent);
		padding: 3px 9px;
		border-radius: 999px;
	}
</style>
