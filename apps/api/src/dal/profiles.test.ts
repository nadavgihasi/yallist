import type { Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { migrate } from '../db/migrate';
import { createTestDatabase, DATABASE_URL, foreignKeys, uniqueKeys } from '../test-db';
import { USER_COLUMNS, USER_KEYED } from './profiles';

/**
 * DSQL has no cascades, so deleteUser and mergeUser walk hand-kept lists of where a user is
 * referenced. These tests compare the lists with the foreign keys and unique keys of the migrated
 * database, so a new table or column that references a profile can't be forgotten: a merge would
 * leave its rows on the deleted guest, and deleting the user would fail on the foreign key.
 */

/**
 * Columns that reference users.id rather than a profile, and why the lists leave them out.
 * A new reference to users.id must be added here, with the code that handles it.
 */
const USERS_REFERENCES: Record<string, string> = {
  // The profile itself: deleteUser deletes it, mergeUser deletes the guest's.
  'profiles.id': 'deleted with the user',
  // Better Auth's: they cascade on user delete, and deleteUser also deletes them when it keeps
  // the user row. A merged guest's are Better Auth's to delete (the anonymous plugin).
  'sessions.user_id': 'cascades, deleted by deleteUser',
  'accounts.user_id': 'cascades, deleted by deleteUser',
};

/**
 * Unique keys that include a profile column but aren't (key, user_id) pairs for USER_KEYED,
 * because mergeUser resolves them with SQL of their own before it moves USER_COLUMNS.
 * (bag_items' (user_id, name) is unique only in code, so it has no key here; mergeUser drops the
 * guest's duplicate names with SQL of its own too.)
 */
const MERGED_BY_OWN_SQL: Record<string, string> = {
  // One active run per shopper and trip: the guest's active run ends and its claims join the
  // account's.
  'shopping_runs(active,shopper_id,trip_id)': 'mergeUser ends the duplicate active run',
};

const key = (table: string, column: string) => `${table}.${column}`;

describe.skipIf(!DATABASE_URL)('the lists of where a user is referenced', () => {
  let sql: Sql;
  let drop: () => Promise<void>;
  let fks: Awaited<ReturnType<typeof foreignKeys>>;

  beforeAll(async () => {
    ({ sql, drop } = await createTestDatabase());
    await migrate(sql, { dsql: false });
    fks = await foreignKeys(sql);
  });

  afterAll(() => drop());

  const profileColumns = () =>
    fks.filter((f) => f.refTable === 'profiles').map((f) => key(f.table, f.column));

  it('USER_COLUMNS lists exactly the columns that reference a profile', () => {
    // Sanity: the catalog query found the schema's foreign keys.
    expect(profileColumns()).toContain('trips.created_by');
    expect(fks.every((f) => f.refTable !== 'profiles' || f.refColumn === 'id')).toBe(true);

    const listed = USER_COLUMNS.map(([table, column]) => key(table, column));
    const missing = profileColumns().filter((c) => !listed.includes(c));
    const extra = listed.filter((c) => !profileColumns().includes(c));
    expect(
      missing,
      `Columns reference profiles.id but are missing from USER_COLUMNS (dal/profiles.ts): ` +
        `add them, or mergeUser leaves their rows on the deleted guest and deleteUser fails on ` +
        `the foreign key`,
    ).toEqual([]);
    expect(
      extra,
      'USER_COLUMNS lists columns that are not foreign keys to profiles.id: remove them',
    ).toEqual([]);
    expect(new Set(listed).size, 'USER_COLUMNS lists a column twice').toBe(listed.length);
  });

  it('every reference to users.id is one the lists may leave out', () => {
    const references = fks.filter((f) => f.refTable === 'users').map((f) => key(f.table, f.column));
    expect(
      references.filter((c) => !(c in USERS_REFERENCES)),
      'Columns reference users.id directly: reference profiles.id instead (then list them in ' +
        'USER_COLUMNS), or handle them in deleteUser and mergeUser and add them to ' +
        'USERS_REFERENCES in this test',
    ).toEqual([]);
    expect(
      Object.keys(USERS_REFERENCES).filter((c) => !references.includes(c)),
      'USERS_REFERENCES in this test names columns that no longer reference users.id',
    ).toEqual([]);
  });

  it('USER_KEYED lists every (key, user_id) unique key with a profile column', async () => {
    const profile = new Set(profileColumns());
    const keys = (await uniqueKeys(sql)).filter((k) =>
      k.columns.some((c) => profile.has(key(k.table, c))),
    );
    // Sanity: the catalog query found the schema's unique keys.
    expect(keys.map((k) => k.table)).toContain('trip_members');

    const listed = USER_KEYED.map(([table, other]) => `${table}(${[other, 'user_id'].sort()})`);
    const found = keys.map((k) => `${k.table}(${k.columns})`);
    const pairs = found.filter((k) => !(k in MERGED_BY_OWN_SQL));
    expect(
      pairs.filter((k) => !listed.includes(k)),
      'Unique keys include a column that references a profile but are not in USER_KEYED ' +
        '(dal/profiles.ts): a (key, user_id) pair goes there as [table, key], so mergeUser drops ' +
        "the guest's duplicate row before moving the rest. Any other key needs SQL of its own in " +
        'mergeUser, then an entry in MERGED_BY_OWN_SQL in this test',
    ).toEqual([]);
    expect(
      listed.filter((k) => !pairs.includes(k)),
      'USER_KEYED lists pairs that are not a unique key of their table: fix or remove them',
    ).toEqual([]);
    expect(
      Object.keys(MERGED_BY_OWN_SQL).filter((k) => !found.includes(k)),
      'MERGED_BY_OWN_SQL in this test names keys the schema no longer has',
    ).toEqual([]);
  });
});
