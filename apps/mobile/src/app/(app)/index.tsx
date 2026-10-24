import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Cover } from '@/components/Cover';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { PastTripRow, TripCard } from '@/features/home/TripCard';
import { initial } from '@/features/trip/derive';
import { he, upcomingCount } from '@/i18n/he';
import { daysBetween, today } from '@/lib/dates';
import { buildDemoTrip } from '@/state/demo';
import { useAppState, useDispatch, useMe } from '@/state/store';
import { colors, fonts, radius } from '@/theme';

export default function Home() {
  const me = useMe();
  const { trips } = useAppState();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();

  const all = Object.values(trips).sort((a, b) => a.trip.startsOn.localeCompare(b.trip.startsOn));
  const now = today();
  const upcoming = all.filter((t) => daysBetween(now, t.trip.endsOn) >= 0);
  const past = all.filter((t) => daysBetween(now, t.trip.endsOn) < 0).reverse();
  const empty = all.length === 0;

  const openDemo = () => {
    const demo = buildDemoTrip(me);
    dispatch({ type: 'createTrip', trip: demo });
    router.push({ pathname: '/trips/[tripId]', params: { tripId: demo.trip.id } });
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 24 + insets.top }]}>
        <View style={styles.header}>
          <View style={styles.titles}>
            <Text style={styles.h1} accessibilityRole="header">
              {he.home.title}
            </Text>
            {upcoming.length > 0 && (
              <Text style={styles.subtitle}>{upcomingCount(upcoming.length)}</Text>
            )}
          </View>
          <View accessibilityLabel={me.name}>
            <Avatar
              person={{ initial: initial(me.name), color: '', isMe: true }}
              size={44}
              ring={false}
            />
          </View>
        </View>

        {empty ? (
          <FirstHome onDemo={openDemo} />
        ) : (
          <>
            {upcoming.map((t, i) => (
              <TripCard key={t.trip.id} data={t} me={me.userId} large={i === 0} />
            ))}
            {past.length > 0 && <Text style={styles.h2}>{he.home.past}</Text>}
            {past.map((t) => (
              <PastTripRow key={t.trip.id} data={t} />
            ))}
          </>
        )}
        <View style={styles.spacer} />
      </ScrollView>
      <View style={[styles.ctaWrap, { bottom: 24 + insets.bottom }]} pointerEvents="box-none">
        <PillButton
          label={empty ? he.firstHome.cta : he.home.newTrip}
          size="xl"
          icon={<Icon name="plus" color={colors.white} />}
          onPress={() => router.push('/trips/new')}
          style={styles.cta}
        />
      </View>
    </View>
  );
}

function FirstHome({ onDemo }: { onDemo: () => void }) {
  return (
    <>
      <View style={styles.card}>
        <Cover scene="camp" style={{ height: 180 }} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{he.firstHome.emptyTitle}</Text>
          <Text style={styles.cardText}>{he.firstHome.emptyText}</Text>
        </View>
      </View>
      <View style={styles.steps}>
        {he.firstHome.steps.map(([title, text], i) => (
          <View key={title} style={styles.step}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <View style={styles.titles}>
              <Text style={styles.stepTitle}>{title}</Text>
              <Text style={styles.stepText}>{text}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.demo}>
        <View style={styles.titles}>
          <Text style={styles.stepTitle}>{he.firstHome.demoTitle}</Text>
          <Text style={styles.stepText}>{he.firstHome.demoText}</Text>
        </View>
        <PillButton label={he.firstHome.demo} variant="soft" onPress={onDemo} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { paddingHorizontal: 16, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  titles: { flex: 1, gap: 4 },
  h1: { fontFamily: fonts.displayBold, fontSize: 36, lineHeight: 40, color: colors.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 15, color: colors.inkSecondary },
  h2: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.ink,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  spacer: { height: 120 },
  ctaWrap: { position: 'absolute', start: 0, end: 0, alignItems: 'center' },
  cta: { height: 60, borderRadius: 30, paddingHorizontal: 28 },
  card: { borderRadius: radius.card, backgroundColor: colors.surface, overflow: 'hidden' },
  cardBody: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 22, gap: 8 },
  cardTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  cardText: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.inkSecondary },
  steps: { borderRadius: radius.group, backgroundColor: colors.surface, paddingVertical: 6 },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  stepNum: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { fontFamily: fonts.display, fontSize: 19, color: colors.accent },
  stepTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  stepText: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkSecondary },
  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
    borderRadius: radius.group,
    backgroundColor: colors.surface,
  },
});
