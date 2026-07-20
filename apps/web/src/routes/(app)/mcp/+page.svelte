<script lang="ts">
	import Copy from '@lucide/svelte/icons/copy';
	import Check from '@lucide/svelte/icons/check';
	import Plug from '@lucide/svelte/icons/plug';

	// Editable so the snippets below become copy-paste-ready for this deployment.
	let workerUrl = $state('https://junto-mcp.<your-subdomain>.workers.dev/mcp');
	let token = $state('YOUR_MCP_BEARER_TOKEN');

	const cursorConfig = $derived(
		JSON.stringify(
			{ mcpServers: { junto: { url: workerUrl, headers: { Authorization: `Bearer ${token}` } } } },
			null,
			2
		)
	);

	const claudeConfig = $derived(
		JSON.stringify(
			{
				mcpServers: {
					junto: {
						command: 'npx',
						args: ['-y', 'mcp-remote', workerUrl, '--header', `Authorization: Bearer ${token}`]
					}
				}
			},
			null,
			2
		)
	);

	const tools = [
		['list_projects', 'List all projects (boards) in the workspace'],
		['list_tasks', 'List tasks, optionally filtered by project or status'],
		['create_task', 'Create a task (title, project, status, priority, due date)'],
		['update_task', 'Update a task by id'],
		['create_project', 'Create a new project']
	];

	let copied = $state<string | null>(null);
	let timer: ReturnType<typeof setTimeout>;
	async function copy(id: string, text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = id;
			clearTimeout(timer);
			timer = setTimeout(() => (copied = null), 1500);
		} catch {
			/* clipboard unavailable */
		}
	}
</script>

<svelte:head><title>MCP · Junto</title></svelte:head>

<header class="border-border flex h-12 shrink-0 items-center gap-2 border-b px-5">
	<Plug class="text-muted-foreground size-4" />
	<h1 class="text-sm font-semibold">MCP · Connect Claude & Cursor</h1>
</header>

<div class="flex-1 overflow-y-auto">
	<div class="mx-auto max-w-3xl space-y-8 p-6">
		<p class="text-muted-foreground text-sm leading-relaxed">
			Junto ships an <span class="text-foreground font-medium">MCP server</span> — a Cloudflare Worker
			that lets AI clients read and manage your tasks over the Model Context Protocol. Deploy it with
			<code class="bg-muted rounded px-1 py-0.5 text-xs">pnpm mcp:deploy</code>, then point Claude or
			Cursor at it with the bearer token you set as the
			<code class="bg-muted rounded px-1 py-0.5 text-xs">MCP_BEARER_TOKEN</code> secret.
		</p>

		<!-- Connection details -->
		<section class="border-border bg-card space-y-4 rounded-xl border p-5">
			<h2 class="text-xs font-medium tracking-wide uppercase text-muted-foreground">Your server</h2>
			<label class="flex flex-col gap-1.5">
				<span class="text-xs font-medium">Worker URL</span>
				<input
					bind:value={workerUrl}
					spellcheck="false"
					class="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 font-mono text-xs outline-none focus-visible:ring-[2px]"
				/>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="text-xs font-medium">Bearer token</span>
				<input
					bind:value={token}
					spellcheck="false"
					class="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 font-mono text-xs outline-none focus-visible:ring-[2px]"
				/>
				<span class="text-muted-foreground text-xs">
					The value you set with <code>wrangler secret put MCP_BEARER_TOKEN</code>. Edit these two
					fields and the snippets below update.
				</span>
			</label>
		</section>

		<!-- Cursor -->
		<section class="space-y-2">
			<h2 class="text-sm font-semibold">Cursor</h2>
			<p class="text-muted-foreground text-sm">
				Add to <code class="bg-muted rounded px-1 py-0.5 text-xs">~/.cursor/mcp.json</code> (global) or
				<code class="bg-muted rounded px-1 py-0.5 text-xs">.cursor/mcp.json</code> in a project, then
				enable “junto” in Cursor → Settings → MCP.
			</p>
			<div class="relative">
				<button
					onclick={() => copy('cursor', cursorConfig)}
					class="border-border bg-card hover:bg-accent absolute top-2.5 right-2.5 flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
				>
					{#if copied === 'cursor'}<Check class="size-3.5" /> Copied{:else}<Copy class="size-3.5" /> Copy{/if}
				</button>
				<pre class="border-border bg-card overflow-x-auto rounded-lg border p-4 text-xs"><code>{cursorConfig}</code></pre>
			</div>
		</section>

		<!-- Claude -->
		<section class="space-y-2">
			<h2 class="text-sm font-semibold">Claude (Desktop)</h2>
			<p class="text-muted-foreground text-sm">
				Claude connects to remote MCP servers through
				<code class="bg-muted rounded px-1 py-0.5 text-xs">mcp-remote</code>, which bridges the
				streamable-HTTP server (with your bearer header) to Claude. Add this to your
				<code class="bg-muted rounded px-1 py-0.5 text-xs">claude_desktop_config.json</code>
				(Settings → Developer → Edit config), then restart Claude.
			</p>
			<div class="relative">
				<button
					onclick={() => copy('claude', claudeConfig)}
					class="border-border bg-card hover:bg-accent absolute top-2.5 right-2.5 flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
				>
					{#if copied === 'claude'}<Check class="size-3.5" /> Copied{:else}<Copy class="size-3.5" /> Copy{/if}
				</button>
				<pre class="border-border bg-card overflow-x-auto rounded-lg border p-4 text-xs"><code>{claudeConfig}</code></pre>
			</div>
			<p class="text-muted-foreground text-xs">
				On claude.ai you can instead add it under Settings → Connectors → “Add custom connector” using
				the Worker URL. For a static bearer token, the <code>mcp-remote</code> route above is the most
				reliable.
			</p>
		</section>

		<!-- Tools -->
		<section class="space-y-2">
			<h2 class="text-sm font-semibold">Available tools</h2>
			<div class="border-border divide-border bg-card divide-y overflow-hidden rounded-xl border">
				{#each tools as [name, desc] (name)}
					<div class="flex items-center gap-3 px-4 py-2.5 text-sm">
						<code class="text-primary shrink-0 font-mono text-xs">{name}</code>
						<span class="text-muted-foreground">{desc}</span>
					</div>
				{/each}
			</div>
		</section>

		<p class="text-muted-foreground text-xs leading-relaxed">
			The bearer token is the entire trust boundary — it authorizes one workspace. Keep it secret and
			rotate it with <code>wrangler secret put MCP_BEARER_TOKEN</code> if it leaks.
		</p>
	</div>
</div>
