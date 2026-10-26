import { coverFor, type CoverId, type TemplateId } from '@yallist/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Cover } from '@/components/Cover';
import { CoverPicker } from '@/components/CoverPicker';
import { DateField } from '@/components/DateField';
import { TextField, fieldStyles } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/ListGroup';
import { Callout } from '@/components/Callout';
import { PillButton } from '@/components/PillButton';
import { TemplateTile } from '@/components/TemplateTile';
import { he } from '@/i18n/he';
import { addDays, endAfterMovingStart, formatRange, today } from '@/lib/dates';
import { testId } from '@/lib/testId';
import { useCreateTrip } from '@/state/trips';
import { colors, radius, size, space, type } from '@/theme';
import { useBreakpoint } from '@/theme/breakpoint';

const KINDS: TemplateId[] = ['camp', 'grill', 'zimmer', 'beach', 'blank'];

/**
 * Web gets a real blur behind the cover label; native keeps the dark translucent panel.
 * Cast because RN's ViewStyle lacks the web-only `backdropFilter` without the generated expo types (as in CI).
 */
const coverLabelBlur = (Platform.OS === 'web' ? { backdropFilter: 'blur(14px)' } : {}) as ViewStyle;

/** Keeps the desktop cover preview in view while the form scrolls (web only). */
const sticky = (Platform.OS === 'web' ? { position: 'sticky', top: 24 } : {}) as ViewStyle;

export default function NewTrip() {
  const createTrip = useCreateTrip();
  const insets = useSafeAreaInsets();
  const bp = useBreakpoint();
  // Tablet: a centered column with an inline button. Desktop: cover preview beside the form.
  const wide = bp !== 'phone';
  const desktop = bp === 'desktop';
  // `?template=` from a home tile preselects it.
  const params = useLocalSearchParams<{ template?: string }>();
  const [template, setTemplate] = useState<TemplateId>(
    () => KINDS.find((k) => k === params.template) ?? 'camp',
  );
  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [startsOn, setStartsOn] = useState(() => addDays(today(), 14));
  const [endsOn, setEndsOn] = useState(() => addDays(today(), 15));

  // Follows the template until one is picked.
  const [pickedCover, setCover] = useState<CoverId>();
  const cover = pickedCover ?? coverFor(template);

  const shownName = name.trim() || he.newTrip.fallbackName;

  const setStart = (iso: string) => {
    setStartsOn(iso);
    setEndsOn(endAfterMovingStart(startsOn, endsOn, iso));
  };
  const createLabel = createTrip.isPending ? he.newTrip.creating : he.newTrip.create;

  const create = () =>
    createTrip.mutate(
      {
        name: shownName,
        startsOn,
        endsOn: endsOn < startsOn ? startsOn : endsOn,
        placeText: place.trim() || undefined,
        template,
        cover,
      },
      {
        onSuccess: ({ trip }) =>
          router.replace({ pathname: '/trips/[tripId]', params: { tripId: trip.id } }),
      },
    );

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          wide && styles.contentWide,
          desktop && styles.contentDesktop,
          { paddingTop: (wide ? 32 : 12) + insets.top },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={he.newTrip.back}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={styles.back}
          >
            <Icon name="back" strokeWidth={2.5} />
          </Pressable>
          <Text style={styles.h1} accessibilityRole="header">
            {he.newTrip.title}
          </Text>
        </View>

        <View style={[styles.body, desktop && styles.columns]}>
          <View style={desktop && [styles.coverCol, sticky]}>
            <Cover scene={cover} style={[styles.cover, desktop && styles.coverDesktop]}>
              <View style={[styles.coverLabel, coverLabelBlur]}>
                <Text style={styles.coverName} numberOfLines={2}>
                  {shownName}
                </Text>
                <Text style={styles.coverDates}>{formatRange(startsOn, endsOn)}</Text>
              </View>
            </Cover>
          </View>

          <View style={[styles.body, desktop && styles.formCol]}>
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.h2}>{he.newTrip.kind}</Text>
                <Text style={styles.hint}>{he.newTrip.kindHint}</Text>
              </View>
              <View
                style={styles.grid}
                accessibilityRole="radiogroup"
                accessibilityLabel={he.newTrip.kind}
              >
                {KINDS.map((k) => (
                  <View key={k} style={styles.tile}>
                    <TemplateTile
                      template={k}
                      role="radio"
                      selected={k === template}
                      testID={`new-trip-template-${k}`}
                      onPress={() => setTemplate(k)}
                    />
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.h2}>{he.cover.title}</Text>
                <Text style={styles.hint}>{he.cover.hint}</Text>
              </View>
              <CoverPicker value={cover} onChange={setCover} />
            </View>

            <Card>
              <TextField
                label={he.newTrip.name}
                value={name}
                onChangeText={setName}
                placeholder={he.newTrip.namePlaceholder}
                {...testId('new-trip-name')}
              />
              <View style={styles.field}>
                <Text style={fieldStyles.label}>{he.newTrip.when}</Text>
                <View style={styles.dates}>
                  <DateField
                    label={he.newTrip.from}
                    value={startsOn}
                    min={today()}
                    onChange={setStart}
                  />
                  <DateField
                    label={he.newTrip.to}
                    value={endsOn}
                    min={startsOn}
                    onChange={setEndsOn}
                  />
                </View>
              </View>
              <TextField
                label={he.newTrip.where}
                hint={he.newTrip.optional}
                value={place}
                onChangeText={setPlace}
                placeholder={he.newTrip.wherePlaceholder}
              />
            </Card>

            <View style={styles.card} accessibilityLiveRegion="polite">
              <Text style={styles.h3}>{he.newTrip.preview}</Text>
              {template === 'blank' ? (
                <Text style={styles.hint}>{he.newTrip.previewBlank}</Text>
              ) : (
                <>
                  <Text style={styles.previewLine}>
                    <Text style={styles.strong}>{he.newTrip.previewBring}</Text>
                    {he.newTrip.previews[template][0]}
                  </Text>
                  <Text style={styles.previewLine}>
                    <Text style={styles.strong}>{he.newTrip.previewBuy}</Text>
                    {he.newTrip.previews[template][1]}
                  </Text>
                </>
              )}
            </View>
            <Callout title={he.states.tip} text={he.newTrip.tip} />
            {wide && (
              <PillButton
                label={createLabel}
                {...testId('new-trip-create')}
                size="lg"
                wide
                disabled={createTrip.isPending}
                onPress={create}
              />
            )}
          </View>
        </View>
        <View style={{ height: wide ? 40 : 110 }} />
      </ScrollView>
      {!wide && (
        <View style={[styles.ctaWrap, { bottom: 24 + insets.bottom }]}>
          <PillButton
            label={createLabel}
            {...testId('new-trip-create')}
            size="lg"
            wide
            float
            disabled={createTrip.isPending}
            onPress={create}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { paddingHorizontal: space.screen, gap: space[4] },
  contentWide: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: space[6] },
  contentDesktop: { maxWidth: 1040, gap: space[6] },
  body: { gap: space[4] },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 32 },
  coverCol: { flex: 1 },
  formCol: { flex: 1.2 },
  coverDesktop: { height: 320 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  back: {
    width: size.avatar,
    height: size.avatar,
    borderRadius: size.avatar / 2,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  h1: { ...type.pageTitle, color: colors.ink },
  cover: { height: 220, borderRadius: radius.card },
  coverLabel: {
    position: 'absolute',
    start: 14,
    end: 14,
    bottom: 14,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderRadius: 20,
    // 0.55 and opaque text: the caption over the sun reaches 4.74:1 (was 3.19).
    backgroundColor: 'rgba(16,23,37,0.55)',
    gap: 2,
  },
  coverName: { ...type.sectionTitle, color: colors.onPrimary },
  coverDates: { ...type.caption, color: colors.onPrimary },
  section: { gap: space[3] },
  sectionHead: { gap: space[1] },
  h2: { ...type.itemTitle, color: colors.ink },
  h3: { ...type.itemTitle, color: colors.ink },
  hint: { ...type.caption, color: colors.inkMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  // Strict two columns, so a lone last tile stays half width (NewTripV2 grid).
  tile: { width: '48.8%' },
  card: {
    padding: space[5],
    borderRadius: radius.card,
    backgroundColor: colors.card,
    gap: space[3],
  },
  field: { gap: space[2] },
  dates: { flexDirection: 'row', gap: space[2] },
  previewLine: { ...type.body, color: colors.ink },
  strong: { fontFamily: type.itemTitle.fontFamily },
  ctaWrap: { position: 'absolute', start: space.screen, end: space.screen },
});
