import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'drizzle-kit';

// Load the single monorepo-root .env so DB tooling and the web app share creds.
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

export default defineConfig({
	schema: './src/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		url: process.env.DATABASE_URL ?? ''
	},
	verbose: true,
	strict: true
});
