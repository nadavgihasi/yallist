import { isLatLng, type LatLng } from '@yallist/domain';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type Place = {
  /** The place's own name, e.g. "חניון עין גדי". */
  name: string;
  /** Its full address, to tell places with the same name apart. */
  address: string;
  point: LatLng;
};

type NominatimRow = { name?: string; display_name: string; lat: string; lon: string };

/**
 * Up to five places matching `query`, named in Hebrew where OpenStreetMap has it, from
 * OpenStreetMap's Nominatim. Its policy allows a search a second at most and no
 * search-as-you-type, so the app searches only when asked. Apps name themselves in the user
 * agent; browsers send the page as the referrer.
 */
export async function searchPlaces(query: string): Promise<Place[]> {
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=he&q=' +
    encodeURIComponent(query.trim());
  const headers: Record<string, string> =
    Platform.OS === 'web'
      ? {}
      : { 'User-Agent': `Yallist/${Constants.expoConfig?.version ?? '0'}` };
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Place search failed: ${res.status}`);
  const rows = (await res.json()) as NominatimRow[];
  return rows
    .map((r) => ({
      name: r.name || r.display_name.split(',')[0]!.trim(),
      address: r.display_name,
      point: { lat: Number(r.lat), lng: Number(r.lon) },
    }))
    .filter((p) => isLatLng(p.point));
}
