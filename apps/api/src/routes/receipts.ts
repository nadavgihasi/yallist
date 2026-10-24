import { Hono } from 'hono';
import { z } from 'zod';

import { fail, validate } from '../access';
import { requireUser, type Auth } from '../auth';
import { logActivity } from '../dal/activity';
import { findExpense, setReceiptPath } from '../dal/expenses';
import { requireMember } from '../dal/members';
import type { Db } from '../db/client';
import { transact } from '../db/tx';
import {
  deleteReceipt,
  newReceiptKey,
  RECEIPT_MAX_BYTES,
  RECEIPT_TYPES,
  receiptPrefix,
  type ReceiptStore,
} from '../receipts';

import { assertMayChange } from './money';

const expenseParam = z.object({ tripId: z.uuid(), expenseId: z.uuid() });
const receiptType = z.enum(Object.keys(RECEIPT_TYPES) as [keyof typeof RECEIPT_TYPES]);

/** `<uuid>.<ext>` under the expense's directory: only keys `upload-url` hands out. */
const ownKey = (tripId: string, expenseId: string, key: string) => {
  const prefix = receiptPrefix(tripId, expenseId);
  const exts = Object.values(RECEIPT_TYPES).join('|');
  return (
    key.startsWith(prefix) &&
    new RegExp(`^[0-9a-f-]{36}\\.(${exts})$`).test(key.slice(prefix.length))
  );
};

/**
 * An expense's receipt photo (SPEC §5): active members upload it straight to the private bucket
 * with a presigned form, then confirm it here; viewing gets a short-lived link.
 */
export const receiptRoutes = (auth: Auth, db: Db, receipts: ReceiptStore) =>
  new Hono()
    .use(requireUser(auth))

    // Where and how to upload. The form's policy enforces the type and the size limit.
    .post(
      '/:tripId/expenses/:expenseId/receipt/upload-url',
      validate('param', expenseParam),
      validate(
        'json',
        z.object({ contentType: receiptType, size: z.int().min(1).max(RECEIPT_MAX_BYTES) }),
      ),
      async (c) => {
        const { tripId, expenseId } = c.req.valid('param');
        const { contentType } = c.req.valid('json');
        await transact(db, async (tx) => {
          await requireMember(tx, tripId, c.var.user.id);
          await findExpense(tx, tripId, expenseId);
        });
        const key = newReceiptKey(tripId, expenseId, contentType);
        return c.json({ key, ...(await receipts.uploadForm(key, contentType)) });
      },
    )

    // The upload finished: attach it to the expense.
    .post(
      '/:tripId/expenses/:expenseId/receipt',
      validate('param', expenseParam),
      validate('json', z.object({ key: z.string().max(200) })),
      async (c) => {
        const { tripId, expenseId } = c.req.valid('param');
        const { key } = c.req.valid('json');
        const me = c.var.user.id;
        if (!ownKey(tripId, expenseId, key)) throw fail(400, 'Not a receipt key of this expense');
        await transact(db, async (tx) => {
          await requireMember(tx, tripId, me, { lock: true });
          const expense = await findExpense(tx, tripId, expenseId, { lock: true });
          // Replacing one deletes it, so that takes deleting the old one first.
          if (expense.receiptPath) throw fail(409, 'Already has a receipt');
          const stored = await receipts.head(key);
          if (!stored) throw fail(400, 'Not uploaded');
          if (
            stored.size > RECEIPT_MAX_BYTES ||
            !Object.hasOwn(RECEIPT_TYPES, stored.contentType)
          ) {
            throw fail(400, 'Not an image of at most 10 MB');
          }
          await setReceiptPath(tx, expenseId, key);
          await logActivity(tx, tripId, me, 'receipt_added', { expenseId });
        });
        return c.body(null, 204);
      },
    )

    .get('/:tripId/expenses/:expenseId/receipt', validate('param', expenseParam), async (c) => {
      const { tripId, expenseId } = c.req.valid('param');
      const { receiptPath } = await transact(db, async (tx) => {
        await requireMember(tx, tripId, c.var.user.id);
        return findExpense(tx, tripId, expenseId);
      });
      if (!receiptPath) throw fail(404, 'No receipt');
      return c.json({ url: await receipts.viewUrl(receiptPath) });
    })

    .delete('/:tripId/expenses/:expenseId/receipt', validate('param', expenseParam), async (c) => {
      const { tripId, expenseId } = c.req.valid('param');
      const me = c.var.user.id;
      const { receiptPath } = await transact(db, async (tx) => {
        const member = await requireMember(tx, tripId, me, { lock: true });
        const expense = await findExpense(tx, tripId, expenseId, { lock: true });
        assertMayChange(expense, member);
        if (!expense.receiptPath) return expense;
        await setReceiptPath(tx, expenseId, null);
        await logActivity(tx, tripId, me, 'receipt_deleted', { expenseId });
        return expense;
      });
      if (receiptPath) await deleteReceipt(receipts, receiptPath);
      return c.body(null, 204);
    });
