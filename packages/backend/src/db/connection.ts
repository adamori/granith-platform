import pg from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import type { Database } from './types.js';

export function createDb(databaseUrl: string): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString: databaseUrl }),
    }),
  });
}
