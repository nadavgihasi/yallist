import { useLocalSearchParams } from 'expo-router';

import { ExpenseForm } from '@/features/trip/ExpenseForm';
import { useTrip } from '@/state/trips';

export default function AddExpense() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const data = useTrip(tripId);
  if (!data) return null;
  return <ExpenseForm data={data} />;
}
