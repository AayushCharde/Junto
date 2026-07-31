<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import Logo from '$lib/components/logo.svelte';
	import LinkOff from '@lucide/svelte/icons/link-2-off';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const message = $derived(
		data.reason === 'expired'
			? 'This invite link has expired. Ask the workspace owner for a new one.'
			: 'This invite link is no longer valid. Ask the workspace owner for a new one.'
	);
</script>

<svelte:head><title>Invite · Junto</title></svelte:head>

<div class="bg-background text-foreground flex min-h-screen items-center justify-center px-6">
	<div class="border-border bg-card w-full max-w-sm rounded-xl border p-6 text-center">
		<div class="mb-4 flex items-center justify-center gap-2.5">
			<Logo class="size-8" />
			<span class="text-lg font-semibold tracking-tight">Junto</span>
		</div>
		<div class="bg-muted mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
			<LinkOff class="text-muted-foreground size-6" />
		</div>
		<h1 class="text-lg font-semibold tracking-tight">Invite unavailable</h1>
		<p class="text-muted-foreground mt-2 text-sm leading-relaxed">{message}</p>
		<Button href="/" variant="outline" class="mt-5 w-full">Go to Junto</Button>
	</div>
</div>
