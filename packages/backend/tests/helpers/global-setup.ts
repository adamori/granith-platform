import { runMigrations } from '../../src/db/migrate.js';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://granith:granith@localhost:5432/granith';

export async function setup() {
  await runMigrations(DATABASE_URL);
}
