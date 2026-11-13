import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { useCloseSheet } from '@/features/trip/closeSheet';
import { ExpenseForm } from '@/features/trip/ExpenseForm';
import { useTrip } from '@/state/trips';

/** Fixes an expense in place (the add-expense sheet, prefilled). */
export default function EditExpense() {
  const { tripId, expenseId } = useLocalSearchParams<{ tripId: string; expenseId: string }>();
  const data = useTrip(tripId);
  const expense = data?.expenses.find((e) => e.id === expenseId);
  const close = useCloseSheet(tripId);
  // Deleted meanwhile.
  useEffect(() => {
    if (data && !expense) close();
  }, [data, expense, close]);
  if (!data || !expense) return null;
  return <ExpenseForm data={data} expense={expense} />;
}
