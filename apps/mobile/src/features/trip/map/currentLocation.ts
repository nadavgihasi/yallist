import type { LatLng } from '@yallist/domain';
import * as Location from 'expo-location';

/**
 * Where the phone or browser is now, asking for location permission first (while the app is in
 * use only). 'denied' when the user says no; throws when there's no fix, e.g. with location off.
 */
export async function currentLocation(): Promise<LatLng | 'denied'> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) return 'denied';
  const { coords } = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return { lat: coords.latitude, lng: coords.longitude };
}
