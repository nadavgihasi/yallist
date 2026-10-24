import { randomBytes } from 'node:crypto';

import postgres from 'postgres';

/** Postgres server for DB tests; CI provides one. Tests that need it skip without it. */
export const DATABASE_URL = process.env.DATABASE_URL;

/** Creates an empty, throwaway database on DATABASE_URL's server. */
export async function createTestDatabase() {
  const name = `yallist_test_${randomBytes(4).toString('hex')}`;
  const admin = postgres(DATABASE_URL!, { onnotice: () => {} });
  await admin.unsafe(`create database ${name}`);
  const url = new URL(DATABASE_URL!);
  url.pathname = `/${name}`;
  const sql = postgres(url.href, { onnotice: () => {} });
  return {
    sql,
    async drop() {
      await sql.end();
      await admin.unsafe(`drop database ${name}`);
      await admin.end();
    },
  };
}
