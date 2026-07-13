<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import Mail from '@lucide/svelte/icons/mail';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Sign in · Junto</title></svelte:head>

<div
	class="bg-background text-foreground relative flex min-h-screen items-center justify-center px-6"
	style="background-image: radial-gradient(60rem 30rem at 50% -10%, color-mix(in srgb, var(--primary) 12%, transparent), transparent);"
>
	<div class="w-full max-w-sm">
		<div class="mb-6 flex items-center gap-2">
			<div
				class="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded text-sm font-bold"
			>
				J
			</div>
			<span class="text-lg font-semibold tracking-tight">Junto</span>
		</div>

		{#if form?.success}
			<div class="border-border bg-card rounded-lg border p-5 text-center">
				<Mail class="text-primary mx-auto mb-3 size-8" />
				<h1 class="text-base font-semibold">Check your email</h1>
				<p class="text-muted-foreground mt-1 text-sm">
					We sent a magic link to <span class="text-foreground">{form.email}</span>. Open it to sign
					in.
				</p>
			</div>
		{:else}
			<h1 class="text-xl font-semibold tracking-tight">Sign in to Junto</h1>
			<p class="text-muted-foreground mt-1 text-sm">
				Enter your email and we'll send you a magic link.
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
				class="mt-5 space-y-3"
			>
				<input
					type="email"
					name="email"
					required
					placeholder="you@example.com"
					value={form?.email ?? ''}
					class="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[2px]"
				/>

				{#if form?.message}
					<p class="text-destructive text-sm">{form.message}</p>
				{/if}

				<Button type="submit" class="w-full" disabled={submitting}>
					{submitting ? 'Sending…' : 'Send magic link'}
				</Button>
			</form>
		{/if}
	</div>
</div>
