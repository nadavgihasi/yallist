import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { parseResponse } from 'hono/client';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { Progress } from '@/components/Progress';
import { Sheet } from '@/components/Sheet';
import { useCloseSheet } from '@/features/trip/closeSheet';
import { ReceiptSources } from '@/features/trip/ReceiptField';
import { he } from '@/i18n/he';
import { api } from '@/lib/api';
import { uploadReceipt, useReceiptUpload } from '@/state/receipts';
import { useMe } from '@/state/store';
import { useTrip, useTripAction } from '@/state/trips';
import type { TripData } from '@/state/types';
import { colors, radius, space, type } from '@/theme';

type Expense = TripData['expenses'][number];

/** An expense's receipt: full screen once there is one, else a sheet to add it. */
export default function Receipt() {
  const { tripId, expenseId } = useLocalSearchParams<{ tripId: string; expenseId: string }>();
  const data = useTrip(tripId);
  const expense = data?.expenses.find((e) => e.id === expenseId);
  const close = useCloseSheet(tripId);
  // Deleted meanwhile.
  useEffect(() => {
    if (data && !expense) close();
  }, [data, expense, close]);
  if (!data || !expense) return null;
  return expense.hasReceipt ? (
    <Viewer data={data} expense={expense} />
  ) : (
    <AddReceipt tripId={tripId} expense={expense} />
  );
}

function AddReceipt({ tripId, expense }: { tripId: string; expense: Expense }) {
  const upload = useReceiptUpload(expense.id);
  const start = (uri: string) => void uploadReceipt(tripId, expense.id, uri);
  const close = useCloseSheet(tripId);

  return (
    <Sheet title={he.receipt.title} subtitle={expense.description} onClose={close}>
      {!upload ? (
        <>
          <Text style={styles.text}>{he.receipt.noneText}</Text>
          <ReceiptSources onPick={start} />
        </>
      ) : (
        <View style={styles.upload}>
          <Image source={{ uri: upload.uri }} style={styles.thumb} resizeMode="cover" />
          <View style={styles.uploadBody}>
            <Text style={styles.text} accessibilityLiveRegion="polite">
              {upload.failed
                ? he.receipt.failed
                : he.receipt.uploading(Math.round(upload.progress * 100))}
            </Text>
            {upload.failed ? (
              <PillButton
                label={he.receipt.retry}
                size="sm"
                style={styles.retry}
                onPress={() => start(upload.uri)}
              />
            ) : (
              <Progress done={upload.progress} total={1} />
            )}
          </View>
        </View>
      )}
    </Sheet>
  );
}

function Viewer({ data, expense }: { data: TripData; expense: Expense }) {
  const tripId = data.trip.id;
  const me = useMe().userId;
  const act = useTripAction(tripId);
  const insets = useSafeAreaInsets();
  const [confirm, setConfirm] = useState(false);
  const close = useCloseSheet(tripId);
  // The link expires after 5 minutes; fetch a fresh one before that.
  const { data: link, isError } = useQuery({
    queryKey: ['receipt', expense.id],
    queryFn: () =>
      parseResponse(
        api.trips[':tripId'].expenses[':expenseId'].receipt.$get({
          param: { tripId, expenseId: expense.id },
        }),
      ),
    staleTime: 4 * 60_000,
    gcTime: 4 * 60_000,
  });
  // As for deleting the expense: the API also lets whoever added it, but the app doesn't know who.
  const organizer = data.members.find((m) => m.userId === me)?.role === 'organizer';
  const mayDelete = expense.paidBy === me || organizer;

  return (
    <View style={[styles.viewer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.bar}>
        <Text style={styles.barTitle} numberOfLines={1}>
          {he.receipt.title} · {expense.description}
        </Text>
        <Pressable
          onPress={() => close()}
          accessibilityRole="button"
          accessibilityLabel={he.receipt.close}
          hitSlop={8}
          style={styles.close}
        >
          <Icon name="close" color={colors.onPrimary} />
        </Pressable>
      </View>
      {/* Pinch to zoom on iOS; Android and the web show it fitted. */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.flex}
        maximumZoomScale={4}
        minimumZoomScale={1}
        centerContent
      >
        {link ? (
          <Image
            source={{ uri: link.url }}
            style={styles.flex}
            resizeMode="contain"
            accessibilityLabel={he.receipt.open}
          />
        ) : (
          isError && <Text style={styles.error}>{he.receipt.loadFailed}</Text>
        )}
      </ScrollView>
      {mayDelete && (
        <View style={styles.actions}>
          <PillButton
            label={confirm ? he.receipt.confirmDelete : he.receipt.delete}
            variant={confirm ? 'card' : 'quiet'}
            size="sm"
            icon={<Icon name="trash" size={18} color={confirm ? colors.ink : colors.inkMuted} />}
            onPress={() => {
              if (!confirm) return setConfirm(true);
              close(() => act({ type: 'deleteReceipt', expenseId: expense.id }));
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  text: { ...type.body, color: colors.inkMuted },
  upload: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  uploadBody: { flex: 1, gap: space[2] },
  retry: { alignSelf: 'flex-start' },
  thumb: { width: 72, height: 72, borderRadius: radius.input, backgroundColor: colors.ground },
  viewer: { flex: 1, backgroundColor: colors.ink },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space.screen,
    minHeight: 56,
  },
  barTitle: { ...type.itemTitle, flex: 1, color: colors.onPrimary },
  close: {
    width: space.touch,
    height: space.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { ...type.body, color: colors.onPrimary, textAlign: 'center', margin: space[6] },
  actions: { alignItems: 'center', padding: space[4] },
});
