import {
  COVER_IDS,
  type ItemKind,
  type ListKind,
  type MemberRole,
  type MemberStatus,
  type TemplateId,
} from '@yallist/domain';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

/**
 * SPEC §3 tables, kept within Aurora DSQL's SQL subset: no enum types (DSQL has no CREATE TYPE),
 * so enums are text with a CHECK; UUID keys; money in integer agorot.
 * Foreign keys are enforced by DSQL. They use the default NO ACTION, not CASCADE: a cascade
 * counts towards DSQL's 3,000-rows-per-transaction limit, so deletes are done in code.
 */

export const TEMPLATE_IDS = [
  'camp',
  'grill',
  'zimmer',
  'beach',
  'blank',
] as const satisfies TemplateId[];
export const LISTS = ['bring', 'buy'] as const satisfies ListKind[];
export const KINDS = ['single', 'qty', 'each'] as const satisfies ItemKind[];
export const ROLES = ['organizer', 'member'] as const satisfies MemberRole[];
const MEMBER_STATUSES = ['pending', 'active', 'removed'] as const satisfies MemberStatus[];
export const TRIP_STATUSES = ['planning', 'ended', 'archived'] as const;
const PAYMENT_STATUSES = ['marked', 'confirmed'] as const;
export const RUN_STATUSES = ['active', 'done', 'cancelled'] as const;

function oneOf(name: string, column: AnyPgColumn, values: readonly string[]) {
  const list = sql.raw(values.map((v) => `'${v}'`).join(', '));
  return check(name, sql`${column} in (${list})`);
}

const positive = (name: string, column: AnyPgColumn) => check(name, sql`${column} > 0`);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const userRef = (name: string) => uuid(name).references(() => profiles.id);

// Better Auth's tables (src/auth.ts), as its Drizzle schema generator writes them for
// `generateId: 'uuid'` and `usePlural`, with timestamptz. Its sessions and accounts cascade
// on user delete; a user has a handful of each, far below DSQL's row limit.

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  /** Set by the anonymous plugin for guests. */
  isAnonymous: boolean('is_anonymous').default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The bearer token. */
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The provider's user id, e.g. the Google `sub`. */
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('accounts_user_idx').on(t.userId)],
);

/** Short-lived values such as OAuth state. */
export const verifications = pgTable(
  'verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)],
);

/** One per user, created on first sign-in (src/auth.ts). */
export const profiles = pgTable('profiles', {
  id: uuid('id')
    .primaryKey()
    .references(() => users.id),
  displayName: text('display_name').notNull(),
  avatarColor: text('avatar_color').notNull(),
  /** Their uploaded photo in the photos bucket (src/avatars.ts); without one, their Google picture. */
  avatarKey: text('avatar_key'),
  /** Shown to trip-mates so they can pay via Bit/PayBox. */
  paymentPhone: text('payment_phone'),
  notifyUpdates: boolean('notify_updates').notNull().default(true),
  notifyDayBefore: boolean('notify_day_before').notNull().default(true),
  notifySettle: boolean('notify_settle').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const trips = pgTable(
  'trips',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on').notNull(),
    placeText: text('place_text'),
    template: text('template', { enum: TEMPLATE_IDS }).notNull(),
    /**
     * Nullable only because DSQL can't add a column with a default: the API always sets it,
     * and `migrate` backfills older trips from their template.
     */
    cover: text('cover', { enum: COVER_IDS }),
    currency: text('currency').notNull().default('ILS'),
    requireApproval: boolean('require_approval').notNull().default(false),
    inviteToken: text('invite_token').notNull().unique(),
    status: text('status', { enum: TRIP_STATUSES }).notNull().default('planning'),
    createdBy: userRef('created_by').notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    oneOf('trips_template_check', t.template, TEMPLATE_IDS),
    oneOf('trips_status_check', t.status, TRIP_STATUSES),
    oneOf('trips_cover_check', t.cover, COVER_IDS),
  ],
);

export const tripMembers = pgTable(
  'trip_members',
  {
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id),
    userId: userRef('user_id').notNull(),
    role: text('role', { enum: ROLES }).notNull(),
    status: text('status', { enum: MEMBER_STATUSES }).notNull(),
    /** Snapshot at join, editable. */
    displayName: text('display_name').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.tripId, t.userId] }),
    index('trip_members_user_idx').on(t.userId),
    oneOf('trip_members_role_check', t.role, ROLES),
    oneOf('trip_members_status_check', t.status, MEMBER_STATUSES),
  ],
);

/**
 * A trip's named groups of items, ordered within their list. They exist apart from items, so a
 * category can be empty. Names are unique per list ignoring case; the index covers exact
 * duplicates (DSQL has no expression indexes), the API checks case under the trip lock.
 */
export const tripCategories = pgTable(
  'trip_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id),
    list: text('list', { enum: LISTS }).notNull(),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('trip_categories_name_idx').on(t.tripId, t.list, t.name),
    oneOf('trip_categories_list_check', t.list, LISTS),
  ],
);

export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id),
    list: text('list', { enum: LISTS }).notNull(),
    /** Null: uncategorized. A category of the item's own list. */
    categoryId: uuid('category_id').references(() => tripCategories.id),
    /**
     * The free-text category from before trip_categories. Read only by the migration runner,
     * which moves it into `categoryId` (src/db/migrate.ts); new rows store ''. DSQL can't drop
     * the column or its NOT NULL.
     */
    legacyCategory: text('category').notNull(),
    position: integer('position').notNull(),
    name: text('name').notNull(),
    kind: text('kind', { enum: KINDS }).notNull(),
    /** 1 for single, ≥2 for qty, ignored for each. */
    quantityNeeded: integer('quantity_needed').notNull().default(1),
    unit: text('unit'),
    /** Free text for buy items, e.g. "4 ק״ג". */
    displayQty: text('display_qty'),
    note: text('note'),
    createdBy: userRef('created_by').notNull(),
    createdAt: createdAt(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    /**
     * Set: a private item in this user's bag, which only they can see or change (packing spec
     * §3). Always one thing on the bring list, which they claim when adding it.
     */
    privateOwnerId: userRef('private_owner_id'),
  },
  (t) => [
    index('items_trip_idx').on(t.tripId),
    oneOf('items_list_check', t.list, LISTS),
    oneOf('items_kind_check', t.kind, KINDS),
    positive('items_quantity_needed_check', t.quantityNeeded),
    check(
      'items_private_check',
      sql`${t.privateOwnerId} is null or (${t.list} = 'bring' and ${t.kind} = 'single' and ${t.quantityNeeded} = 1)`,
    ),
  ],
);

export const claims = pgTable(
  'claims',
  {
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id),
    userId: userRef('user_id').notNull(),
    quantity: integer('quantity').notNull(),
    /** Set in trip-day mode. */
    arrivedAt: timestamp('arrived_at', { withTimezone: true }),
    /** The shopping run that claimed it. */
    runId: uuid('run_id').references((): AnyPgColumn => shoppingRuns.id),
    /** Checked off in the store; means something only while the run is active. */
    inCartAt: timestamp('in_cart_at', { withTimezone: true }),
    /** In the claimer's bag. Only they set it; claiming more clears it. */
    packedAt: timestamp('packed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.itemId, t.userId] }),
    positive('claims_quantity_check', t.quantity),
  ],
);

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id),
    /**
     * The buy-list item a single-item purchase covers. Superseded by expense_items, which is what
     * "bought" reads; still written for single-item purchases until a follow-up drops it.
     */
    itemId: uuid('item_id').references(() => items.id),
    description: text('description').notNull(),
    amountAgorot: integer('amount_agorot').notNull(),
    paidBy: userRef('paid_by').notNull(),
    createdBy: userRef('created_by').notNull(),
    receiptPath: text('receipt_path'),
    createdAt: createdAt(),
  },
  (t) => [
    index('expenses_trip_idx').on(t.tripId),
    positive('expenses_amount_check', t.amountAgorot),
  ],
);

/** The participants an expense is split between. */
export const expenseShares = pgTable(
  'expense_shares',
  {
    expenseId: uuid('expense_id')
      .notNull()
      .references(() => expenses.id),
    userId: userRef('user_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.expenseId, t.userId] })],
);

/** The buy items a purchase covers: one expense per item at most, so an item is bought once. */
export const expenseItems = pgTable(
  'expense_items',
  {
    expenseId: uuid('expense_id')
      .notNull()
      .references(() => expenses.id),
    itemId: uuid('item_id')
      .notNull()
      .references(() => items.id),
  },
  (t) => [
    primaryKey({ columns: [t.expenseId, t.itemId] }),
    unique('expense_items_item_unique').on(t.itemId),
  ],
);

/**
 * One shopper's trip to the store: they claim many buy items at once, check them off, and pay
 * once. At most one active run per shopper and trip. DSQL has no partial indexes, so `active` is
 * true while the run is active and null after; nulls are distinct in a unique index, so the
 * unique (trip, shopper, active) allows any number of finished runs and one active one.
 */
export const shoppingRuns = pgTable(
  'shopping_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id),
    shopperId: userRef('shopper_id').notNull(),
    status: text('status', { enum: RUN_STATUSES }).notNull(),
    active: boolean('active'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    expenseId: uuid('expense_id').references(() => expenses.id),
  },
  (t) => [
    unique('shopping_runs_active_unique').on(t.tripId, t.shopperId, t.active),
    oneOf('shopping_runs_status_check', t.status, RUN_STATUSES),
    check(
      'shopping_runs_active_check',
      sql`(${t.status} = 'active' and ${t.active}) or (${t.status} <> 'active' and ${t.active} is null)`,
    ),
  ],
);

/** A recorded settle-up transfer. */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id),
    fromUser: userRef('from_user').notNull(),
    toUser: userRef('to_user').notNull(),
    amountAgorot: integer('amount_agorot').notNull(),
    status: text('status', { enum: PAYMENT_STATUSES }).notNull().default('marked'),
    markedAt: timestamp('marked_at', { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    remindedAt: timestamp('reminded_at', { withTimezone: true }),
  },
  (t) => [
    index('payments_trip_idx').on(t.tripId),
    positive('payments_amount_check', t.amountAgorot),
    oneOf('payments_status_check', t.status, PAYMENT_STATUSES),
  ],
);

/** Written by the API in the same transaction as the change it records. */
export const activity = pgTable(
  'activity',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id),
    /** Null for system events. */
    actor: userRef('actor'),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('activity_trip_idx').on(t.tripId, t.createdAt)],
);

/** Seed data for new trips, loaded from `@yallist/domain` TEMPLATES by the migration runner. */
export const templateItems = pgTable(
  'template_items',
  {
    template: text('template', { enum: TEMPLATE_IDS }).notNull(),
    list: text('list', { enum: LISTS }).notNull(),
    /** Order within the template's list. */
    position: integer('position').notNull(),
    category: text('category').notNull(),
    name: text('name').notNull(),
    kind: text('kind', { enum: KINDS }).notNull(),
    quantityNeeded: integer('quantity_needed').notNull(),
    unit: text('unit'),
    displayQty: text('display_qty'),
  },
  (t) => [primaryKey({ columns: [t.template, t.list, t.position] })],
);

export const FEEDBACK_KINDS = ['feature', 'bug'] as const;
export const PLATFORMS = ['ios', 'android', 'web'] as const;

/** Feature requests and bug reports sent from the app; each is also a GitHub issue when possible. */
export const feedback = pgTable(
  'feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: userRef('user_id').notNull(),
    kind: text('kind', { enum: FEEDBACK_KINDS }).notNull().default('feature'),
    title: text('title').notNull(),
    body: text('body').notNull(),
    appVersion: text('app_version').notNull(),
    platform: text('platform', { enum: PLATFORMS }).notNull(),
    stage: text('stage').notNull(),
    /** Set once the issue is created; null while the API has no GitHub token, or it failed. */
    githubIssueNumber: integer('github_issue_number'),
    /**
     * When opening the issue started: a claim, so only one sender opens it. Set alone while in
     * flight (or after a crash mid-send), cleared if it failed. The daily issue cap counts these.
     */
    githubIssueAt: timestamp('github_issue_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('feedback_user_idx').on(t.userId, t.createdAt),
    oneOf('feedback_kind_check', t.kind, FEEDBACK_KINDS),
    oneOf('feedback_platform_check', t.platform, PLATFORMS),
  ],
);
