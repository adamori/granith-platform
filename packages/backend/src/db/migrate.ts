import { runner } from 'node-pg-migrate';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function runMigrations(databaseUrl: string, direction: 'up' | 'down' = 'up') {
  await runner({
    databaseUrl,
    dir: resolve(__dirname, 'migrations'),
    direction,
    migrationsTable: 'pgmigrations',
    log: console.log,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    console.error('DATABASE_URL required');
    process.exit(1);
  }
  const direction = process.argv[2] === 'down' ? 'down' as const : 'up' as const;
  runMigrations(url, direction).then(() => {
    console.log(`Migrations ${direction} complete`);
    process.exit(0);
  }).catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
