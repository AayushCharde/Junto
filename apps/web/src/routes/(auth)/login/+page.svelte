<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import Mail from '@lucide/svelte/icons/mail';
	import Command from '@lucide/svelte/icons/command';
	import LayoutList from '@lucide/svelte/icons/layout-list';
	import Bot from '@lucide/svelte/icons/bot';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let submitting = $state(false);

	const signedOut = $derived(page.url.searchParams.get('signedout') !== null);

	const features = [
		{ icon: Command, label: '⌘K command palette & keyboard shortcuts' },
		{ icon: LayoutList, label: 'Boards, lists, subtasks, labels & due dates' },
		{ icon: Bot, label: 'Create and manage tasks right from Claude' }
	];
</script>

<svelte:head><title>Sign in · Junto</title></svelte:head>

<div class="bg-background text-foreground grid min-h-screen lg:grid-cols-2">
	<!-- ── Brand panel ─────────────────────────────────────────────── -->
	<aside
		class="border-border relative hidden flex-col justify-between overflow-hidden border-r p-10 lg:flex"
		style="background-image:
			radial-gradient(42rem 26rem at 8% -8%, color-mix(in srgb, var(--primary) 22%, transparent), transparent 60%),
			radial-gradient(40rem 30rem at 108% 112%, color-mix(in srgb, #3b82f6 26%, transparent), transparent 55%);"
	>
		<div class="flex items-center gap-2.5">
			<div
				class="text-primary-foreground flex size-7 items-center justify-center rounded-lg text-sm font-bold"
				style="background: linear-gradient(135deg, var(--primary), #3b82f6);"
			>
				J
			</div>
			<span class="text-lg font-semibold tracking-tight">Junto</span>
		</div>

		<div class="max-w-md">
			<h2 class="text-4xl font-semibold tracking-tight" style="text-wrap: balance;">
				Your work, one keystroke away.
			</h2>
			<p class="text-muted-foreground mt-4 text-[15px] leading-relaxed">
				A keyboard-first task tracker — boards, lists and labels that stay out of your way, wherever
				you work.
			</p>

			<ul class="mt-8 space-y-3.5">
				{#each features as feature (feature.label)}
					{@const Icon = feature.icon}
					<li class="flex items-center gap-3">
						<span
							class="border-border/60 bg-background/40 flex size-8 shrink-0 items-center justify-center rounded-lg border backdrop-blur"
						>
							<Icon class="text-primary size-4" />
						</span>
						<span class="text-foreground/85 text-sm">{feature.label}</span>
					</li>
				{/each}
			</ul>
		</div>

		<p class="text-muted-foreground/70 text-xs">100% open-source · magic-link sign-in · no passwords</p>
	</aside>

	<!-- ── Form panel ──────────────────────────────────────────────── -->
	<main class="flex items-center justify-center px-6 py-12">
		<div class="w-full max-w-sm">
			<!-- Compact brand mark for small screens (brand panel is hidden). -->
			<div class="mb-8 flex items-center gap-2 lg:hidden">
				<div
					class="text-primary-foreground flex size-6 items-center justify-center rounded text-sm font-bold"
					style="background: linear-gradient(135deg, var(--primary), #3b82f6);"
				>
					J
				</div>
				<span class="text-lg font-semibold tracking-tight">Junto</span>
			</div>

			{#if form?.success}
				<div class="border-border bg-card rounded-xl border p-6 text-center">
					<div
						class="bg-primary/10 mx-auto mb-4 flex size-12 items-center justify-center rounded-full"
					>
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
