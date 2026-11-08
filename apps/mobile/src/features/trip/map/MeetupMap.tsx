import type { LatLng } from '@yallist/domain';
import { useRef, useState } from 'react';
import { I18nManager, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { currentLocation } from './currentLocation';
import { MapFrame } from './MapFrame';
import { searchPlaces, type Place } from './searchPlaces';
import type { MapHandle } from './types';

import { TextField } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { colors, radius, space, type } from '@/theme';

/**
 * Picks the meetup point: search for a place, use the current location, or tap the map and drag
 * the pin. Choosing a search result also names the place when it has no name yet (`onName`).
 */
export function MeetupMap({
  point,
  onPoint,
  onName,
}: {
  point: LatLng | undefined;
  onPoint: (point: LatLng | undefined) => void;
  onName: (name: string) => void;
}) {
  const map = useRef<MapHandle>(null);
  // The map loads on first use: not on every open of the sheet.
  const [open, setOpen] = useState(point !== undefined);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[] | undefined>();
  const [search, setSearch] = useState<'idle' | 'busy' | 'failed'>('idle');
  const [locating, setLocating] = useState<'idle' | 'busy' | 'denied' | 'failed'>('idle');

  const locate = async () => {
    if (locating === 'busy') return;
    setOpen(true);
    setLocating('busy');
    try {
      const here = await currentLocation();
      if (here === 'denied') {
        setLocating('denied');
        return;
      }
      onPoint(here);
      // The map mounted with the press above; it shows the point once it has loaded.
      map.current?.send({ type: 'show', ...here });
      setLocating('idle');
    } catch {
      setLocating('failed');
    }
  };
  // Before the map opens it sits next to "בחירה במפה"; then it floats on the map, in sight
  // without scrolling, as in map apps.
  const onMap = open && !failed;
  const locateButton = (
    <PillButton
      label={locating === 'busy' ? he.links.locating : he.links.myLocation}
      variant={onMap ? 'card' : 'soft'}
      size={onMap ? 'sm' : 'md'}
      disabled={locating === 'busy'}
      icon={<Icon name="locate" size={18} color={colors.primaryStrong} />}
      {...testId('meetup-my-location')}
      onPress={locate}
      style={onMap && [styles.onMap, ON_MAP_CORNER]}
    />
  );

  if (!open) {
    return (
      <View style={styles.startRow}>
        <PillButton
          label={he.links.pickOnMap}
          variant="soft"
          icon={<Icon name="pin" size={18} color={colors.primaryStrong} />}
          {...testId('meetup-map-open')}
          onPress={() => setOpen(true)}
        />
        {locateButton}
      </View>
    );
  }

  const find = async () => {
    if (!query.trim() || search === 'busy') return;
    setSearch('busy');
    try {
      setResults(await searchPlaces(query));
      setSearch('idle');
    } catch {
      setSearch('failed');
    }
  };
  const choose = (place: Place) => {
    onPoint(place.point);
    onName(place.name);
    map.current?.send({ type: 'show', ...place.point });
    setResults(undefined);
  };
  const remove = () => {
    onPoint(undefined);
    map.current?.send({ type: 'clear' });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.searchRow}>
        <View style={styles.grow}>
          <TextField
            label={he.links.searchLabel}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={find}
            returnKeyType="search"
            placeholder={he.links.searchPlaceholder}
            error={search === 'failed' ? he.links.searchFailed : undefined}
            {...testId('meetup-search')}
          />
        </View>
        <PillButton
          label={he.links.search}
          variant="soft"
          disabled={!query.trim() || search === 'busy'}
          {...testId('meetup-search-go')}
          onPress={find}
          style={styles.searchButton}
        />
      </View>
      {results && (
        <View style={styles.results}>
          {results.length === 0 ? (
            <Text style={styles.empty}>{he.links.noResults}</Text>
          ) : (
            results.map((place, i) => (
              <Pressable
                key={`${place.point.lat},${place.point.lng}`}
                accessibilityRole="button"
                {...testId(`meetup-result-${i}`)}
                onPress={() => choose(place)}
                style={({ pressed }) => [styles.result, pressed && styles.pressed]}
              >
                <Text style={styles.resultName} numberOfLines={1}>
                  {place.name}
                </Text>
                <Text style={styles.resultAddress} numberOfLines={1}>
                  {place.address}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      )}
      {failed ? (
        <Text style={styles.empty}>{he.links.mapFailed}</Text>
      ) : (
        <View style={styles.map} {...testId('meetup-map')}>
          <MapFrame
            ref={map}
            initial={point}
            label={he.links.mapLabel}
            onMessage={(m) => {
              if (m.type === 'pick') onPoint({ lat: m.lat, lng: m.lng });
              if (m.type === 'failed') setFailed(true);
            }}
          />
          {locateButton}
        </View>
      )}
      {failed && locateButton}
      <Text
        style={[styles.hint, (locating === 'denied' || locating === 'failed') && styles.error]}
        {...testId('meetup-point-state')}
      >
        {locating === 'denied'
          ? he.links.locationDenied
          : locating === 'failed'
            ? he.links.locationFailed
            : point
              ? he.links.pointPicked
              : he.links.mapHint}
      </Text>
      {point && (
        <PillButton
          label={he.links.removePoint}
          variant="quiet"
          size="sm"
          {...testId('meetup-point-remove')}
          onPress={remove}
          style={styles.remove}
        />
      )}
    </View>
  );
}

/**
 * The map's top right corner, across from its zoom buttons (top left: the map page is LTR).
 * React Native swaps left and right in RTL on Android and iOS, so there it's `left`.
 */
const ON_MAP_CORNER =
  I18nManager.isRTL && Platform.OS !== 'web' ? { left: space[2] } : { right: space[2] };

const styles = StyleSheet.create({
  startRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  wrap: { gap: space[3] },
  searchRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space[2] },
  grow: { flex: 1 },
  searchButton: { marginBottom: 4 },
  results: {
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  result: { paddingHorizontal: space[3], paddingVertical: space[2], gap: 2 },
  pressed: { backgroundColor: colors.ground },
  resultName: { ...type.itemTitle, color: colors.ink },
  resultAddress: { ...type.caption, color: colors.inkMuted },
  empty: { ...type.caption, color: colors.inkMuted },
  map: {
    height: 260,
    borderRadius: radius.input,
    overflow: 'hidden',
    backgroundColor: colors.ground,
  },
  onMap: { position: 'absolute', top: space[2], borderWidth: 1, borderColor: colors.line },
  remove: { alignSelf: 'flex-start' },
  hint: { ...type.caption, color: colors.inkMuted },
  error: { color: colors.brandStrong },
});
