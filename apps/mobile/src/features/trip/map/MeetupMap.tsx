import type { LatLng } from '@yallist/domain';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
 * Picks the meetup point: search for a place, or tap the map and drag the pin. Choosing a search
 * result also names the place when it has no name yet (`onName`).
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

  if (!open) {
    return (
      <PillButton
        label={he.links.pickOnMap}
        variant="soft"
        icon={<Icon name="pin" size={18} color={colors.primaryStrong} />}
        {...testId('meetup-map-open')}
        onPress={() => setOpen(true)}
        style={styles.start}
      />
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
        </View>
      )}
      <View style={styles.footer}>
        <Text style={styles.hint} {...testId('meetup-point-state')}>
          {point ? he.links.pointPicked : he.links.mapHint}
        </Text>
        {point && (
          <PillButton
            label={he.links.removePoint}
            variant="quiet"
            size="sm"
            {...testId('meetup-point-remove')}
            onPress={remove}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  start: { alignSelf: 'flex-start' },
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
  footer: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  hint: { ...type.caption, color: colors.inkMuted, flex: 1 },
});
