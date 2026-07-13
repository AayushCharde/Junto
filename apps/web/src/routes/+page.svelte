<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { TASK_STATUS_LABELS, TASK_STATUS_ORDER } from '@junto/core';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import BookOpen from '@lucide/svelte/icons/book-open';

	// Phase 0 landing: confirms the stack (SvelteKit + Tailwind + shadcn-svelte +
	// @junto/core) is wired end to end. The real tracker arrives in Phase 1.
	const stack = [
		'SvelteKit + Svelte 5 (runes)',
		'Tailwind CSS v4 + shadcn-svelte',
		'Cloudflare Workers (adapter-cloudflare)',
		'Supabase Postgres + Drizzle ORM',
		'@junto/core + @junto/db workspace packages'
	];
</script>

<main class="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
	<header class="space-y-2">
		<p class="text-muted-foreground text-sm font-medium tracking-widest uppercase">Junto</p>
		<h1 class="text-3xl font-semibold tracking-tight">Phase 0 — foundation is live.</h1>
		<p class="text-muted-foreground">
			The monorepo, database schema, and Cloudflare-ready SvelteKit app are wired up. The tracker
			itself ships in Phase 1.
		</p>
	</header>

	<section class="border-border bg-card rounded-lg border p-5">
		<h2 class="mb-3 text-sm font-medium">Stack</h2>
		<ul class="space-y-2">
			{#each stack as item (item)}
				<li class="text-muted-foreground flex items-center gap-2 text-sm">
					<CircleCheck class="text-primary size-4" />
					{item}
				</li>
			{/each}
		</ul>
	</section>

	<section class="border-border bg-card rounded-lg border p-5">
		<h2 class="mb-3 text-sm font-medium">Shared task statuses (from @junto/core)</h2>
		<div class="flex flex-wrap gap-2">
			{#each TASK_STATUS_ORDER as status (status)}
				<span
					class="border-border bg-secondary text-secondary-foreground rounded-full border px-2.5 py-1 text-xs"
				>
					{TASK_STATUS_LABELS[status]}
				</span>
			{/each}
		</div>
	</section>

	<div class="flex items-center gap-3">
		<Button href="https://svelte.dev/docs/kit" size="sm">
			<BookOpen class="size-4" />
			SvelteKit docs
		</Button>
		<Button href="https://orm.drizzle.team" variant="outline" size="sm">Drizzle docs</Button>
	</div>
</main>
