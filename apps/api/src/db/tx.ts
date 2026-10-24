import type { Db } from './client';

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** What the data access layer runs queries on: the database, or a transaction. */
export type Executor = Db | Tx;

/**
 * DSQL's optimistic concurrency: a transaction that conflicts with another one fails at commit
 * with SQLSTATE 40001, and DSQL's codes OC000 (data) or OC001 (schema) in the message. Drizzle
 * wraps query errors, so look through the `cause` chain.
 */
export function isRetryable(error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if ((e as { code?: unknown }).code === '40001' || /\bOC00[01]\b/.test(e.message)) return true;
  }
  return false;
}

/** Runs `fn` again on a write conflict, with jittered exponential backoff, a few times at most. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 5, baseDelayMs = 20 } = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= attempts || !isRetryable(error)) throw error;
      const delay = Math.random() * baseDelayMs * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/** One transaction, retried as a whole on a write conflict. */
export const transact = <T>(db: Db, fn: (tx: Tx) => Promise<T>) =>
  withRetry(() => db.transaction(fn));
