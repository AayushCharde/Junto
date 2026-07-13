import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		// $env/* modules read .env from here; point at the monorepo root so the
		// single shared .env (and Cloudflare secrets) are picked up.
		env: { dir: '../../' }
	}
};

export default config;
