import { DsqlSigner } from '@aws-sdk/dsql-signer';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import { Resource } from 'sst';

import * as schema from './schema';

/** True when connecting to the linked Aurora DSQL cluster rather than plain Postgres. */
export const isDsql = !process.env.DATABASE_URL;

/**
 * Plain Postgres from `DATABASE_URL` (local dev, tests), otherwise the linked DSQL cluster
 * (Lambda, or `sst shell` in CI) with a short-lived IAM auth token as the password.
 */
export function connect() {
  if (process.env.DATABASE_URL) return postgres(process.env.DATABASE_URL);
  const { endpoint, region } = Resource.Database;
  const signer = new DsqlSigner({ hostname: endpoint, region });
  return postgres({
    host: endpoint,
    database: 'postgres',
    username: 'admin',
    password: () => signer.getDbConnectAdminAuthToken(),
    ssl: 'require',
  });
}

export const createDb = (sql: Sql) => drizzle(sql, { schema });
export type Db = ReturnType<typeof createDb>;
