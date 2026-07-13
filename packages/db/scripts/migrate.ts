/**
 * Applies pending Drizzle migrations to the database in DATABASE_URL.
 * Run with: pnpm db:migrate
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('DATABASE_URL is not set. Add it to the repo-root .env file.');
	process.exit(1);
}

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

const client = postgres(url, { max: 1 });
const db = drizzle(client);

console.log('Running migrations from', migrationsFolder);
await migrate(db, { migrationsFolder });
console.log('Migrations complete.');

await client.end();
