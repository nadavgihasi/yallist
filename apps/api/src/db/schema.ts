import type { ItemKind, ListKind, MemberRole, MemberStatus, TemplateId } from '@yallist/domain';
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
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

/**
 * SPEC §3 tables, kept within Aurora DSQL's SQL subset: no enum types (DSQL has no CREATE TYPE),
 * so enums are text with a CHECK; UUID keys; money in integer agorot.
 * Foreign keys are enforced by DSQL. They use the default NO ACTION, not CASCADE: a cascade
 * counts towards DSQL's 3,000-rows-per-transaction limit, so deletes are done in code.
 */

const TEMPLATE_IDS = ['camp', 'grill', 'zimmer', 'beach', 'blank'] as const satisfies TemplateId[];
const LISTS = ['bring', 'buy'] as const satisfies ListKind[];
const KINDS = ['single', 'qty', 'each'] as const satisfies ItemKind[];
const ROLES = ['organizer', 'member'] as const satisfies MemberRole[];
const MEMBER_STATUSES = ['pending', 'active', 'removed'] as const satisfies MemberStatus[];
const TRIP_STATUSES = ['planning', 'ended', 'archived'] as const;
const PAYMENT_STATUSES = ['marked', 'confirmed'] as const;

function oneOf(name: string, column: AnyPgColumn, values: readonly string[]) {
  const list = sql.raw(values.map((v) => `'${v}'`).join(', '));
  return check(name, sql`${column} in (${list})`);
}

const positive = (name: string, column: AnyPgColumn) => check(name, sql`${column} > 0`);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const userRef = (name: string) => uuid(name).references(() => profiles.id);

export const profiles = pgTable('profiles', {
  /** The auth user id. */
  id: uuid('id').primaryKey(),
  displayName: text('display_name').notNull(),
  avatarColor: text('avatar_color').notNull(),
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

export const items = pgTable(
  'items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trips.id),
    list: text('list', { enum: LISTS }).notNull(),
    category: text('category').notNull(),
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
  },
  (t) => [
    index('items_trip_idx').on(t.tripId),
    oneOf('items_list_check', t.list, LISTS),
    oneOf('items_kind_check', t.kind, KINDS),
    positive('items_quantity_needed_check', t.quantityNeeded),
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
    /** The buy-list item this purchase covers. */
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
