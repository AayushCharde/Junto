import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	// Single monorepo-root .env shared by the web app and the DB tooling.
	envDir: fileURLToPath(new URL('../../', import.meta.url)),
	// Workspace packages ship TypeScript source; let Vite transpile them.
	ssr: {
		noExternal: ['@junto/core', '@junto/db']
	}
});
