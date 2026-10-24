import { TEMPLATES, type TemplateId } from '@yallist/domain';
import { router } from 'expo-router';
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

import { Cover, SCENE_TINT } from '@/components/Cover';
import { DateField } from '@/components/DateField';
import { TextField, fieldStyles } from '@/components/Fields';
import { Icon, type IconName } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { he, itemsCount } from '@/i18n/he';
import { addDays, formatRange, today } from '@/lib/dates';
import { useCreateTrip } from '@/state/trips';
import { colors, fonts, radius } from '@/theme';
import { useBreakpoint } from '@/theme/breakpoint';

const KINDS: TemplateId[] = ['camp', 'grill', 'zimmer', 'beach', 'blank'];
const TEMPLATE_ICON: Record<TemplateId, IconName> = {
  camp: 'tent',
  grill: 'flame',
  zimmer: 'house',
  beach: 'beach',
  blank: 'plus',
};

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
  const [template, setTemplate] = useState<TemplateId>('camp');
  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [startsOn, setStartsOn] = useState(() => addDays(today(), 14));
  const [endsOn, setEndsOn] = useState(() => addDays(today(), 15));

  const shownName = name.trim() || he.newTrip.fallbackName;
  // The blank cover is pale all over: ink text without the dark panel (as on the trip screen).
  const blank = template === 'blank';
  const inkText = blank && { color: colors.ink };

  const setStart = (iso: string) => {
    setStartsOn(iso);
    if (endsOn < iso) setEndsOn(iso);
  };

  const create = () =>
    createTrip.mutate(
      {
        name: shownName,
        startsOn,
        endsOn: endsOn < startsOn ? startsOn : endsOn,
        placeText: place.trim() || undefined,
        template,
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
            <Icon name="back" />
          </Pressable>
          <Text style={styles.h1} accessibilityRole="header">
            {he.newTrip.title}
          </Text>
        </View>

        <View style={[styles.body, desktop && styles.columns]}>
          <View style={desktop && [styles.coverCol, sticky]}>
            <Cover scene={template} style={[styles.cover, desktop && styles.coverDesktop]}>
              <View style={[styles.coverLabel, blank ? styles.coverLabelPlain : coverLabelBlur]}>
                <Text style={[styles.coverName, inkText]} numberOfLines={2}>
                  {shownName}
                </Text>
                <Text style={[styles.coverDates, inkText]}>{formatRange(startsOn, endsOn)}</Text>
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
                {KINDS.map((k) => {
                  const selected = k === template;
                  const count = TEMPLATES[k].length;
                  return (
                    <Pressable
                      key={k}
                      accessibilityRole="radio"
                      accessibilityLabel={he.newTrip.templates[k]}
                      accessibilityState={{ checked: selected }}
                      onPress={() => setTemplate(k)}
                      style={[styles.tile, selected && styles.tileOn]}
                    >
                      <View style={[styles.swatch, { backgroundColor: SCENE_TINT[k] }]}>
                        <Icon name={TEMPLATE_ICON[k]} size={24} strokeWidth={1.9} />
                      </View>
                      <Text style={styles.tileName}>{he.newTrip.templates[k]}</Text>
                      <Text style={styles.tileMeta}>
                        {count ? itemsCount(count) : he.newTrip.blankHint}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.card}>
              <TextField
                label={he.newTrip.name}
                value={name}
                onChangeText={setName}
                placeholder={he.newTrip.namePlaceholder}
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
            </View>

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
            {wide && (
              <PillButton
                label={he.newTrip.create}
                size="lg"
                wide
                style={styles.cta}
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
            label={he.newTrip.create}
            size="lg"
            wide
            style={styles.cta}
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
  content: { paddingHorizontal: 16, gap: 18 },
  contentWide: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 24 },
  contentDesktop: { maxWidth: 1040, gap: 24 },
  body: { gap: 18 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 32 },
  coverCol: { flex: 1 },
  formCol: { flex: 1.2 },
  coverDesktop: { height: 320 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  h1: { fontFamily: fonts.extraBold, fontSize: 28, color: colors.ink },
  cover: { height: 220, borderRadius: radius.card },
  coverLabel: {
    position: 'absolute',
    start: 14,
    end: 14,
    bottom: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(14,23,38,0.45)',
    gap: 2,
  },
  coverLabelPlain: { backgroundColor: 'transparent' },
  coverName: { fontFamily: fonts.extraBold, fontSize: 26, color: colors.onPrimary },
  coverDates: { fontFamily: fonts.regular, fontSize: 14, color: colors.onPrimary, opacity: 0.9 },
  section: { gap: 10 },
  sectionHead: { gap: 2, paddingHorizontal: 4 },
  h2: { fontFamily: fonts.extraBold, fontSize: 22, color: colors.ink },
  h3: { fontFamily: fonts.extraBold, fontSize: 19, color: colors.ink },
  hint: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  // Strict two columns, so a lone last tile stays half width (NewTripV2 grid).
  tile: {
    width: '48.8%',
    minHeight: 120,
    padding: 14,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.card,
    backgroundColor: colors.card,
    gap: 8,
  },
  tileOn: { borderColor: colors.primary, boxShadow: '0 6px 18px rgba(14,23,38,0.10)' },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileName: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  tileMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted },
  card: { padding: 16, borderRadius: radius.card, backgroundColor: colors.card, gap: 16 },
  field: { gap: 8 },
  dates: { flexDirection: 'row', gap: 8 },
  previewLine: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.ink },
  strong: { fontFamily: fonts.bold },
  ctaWrap: { position: 'absolute', start: 16, end: 16 },
  cta: { minHeight: 60, borderRadius: 30 },
});
