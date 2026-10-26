import { router } from 'expo-router';

import { StateScreen } from '@/components/EmptyState';
import { he } from '@/i18n/he';

export default function NotFound() {
  return (
    <StateScreen
      spot="signpost"
      {...he.states.notFound}
      actions={[{ label: he.states.toTrips, onPress: () => router.replace('/') }]}
    />
  );
}
