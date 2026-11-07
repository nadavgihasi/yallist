import type { LatLng } from '@yallist/domain';

import { colors } from '@/theme';

/** What the map page tells the app: it loaded, a point was picked, or Leaflet didn't load. */
export type FromMap =
  { type: 'ready' } | { type: 'pick'; lat: number; lng: number } | { type: 'failed' };
/** What the app tells the map page: put the pin on a point and show it, or take the pin away. */
export type ToMap = { type: 'show'; lat: number; lng: number } | { type: 'clear' };

/** With no point yet, the map shows Israel. */
const START = { lat: 31.4, lng: 35.0, zoom: 7 };
/** How close a point is shown: streets and parking lots. */
const POINT_ZOOM = 16;

const PIN = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46"><path d="M18 44S33 28.6 33 17.5a15 15 0 0 0-30 0C3 28.6 18 44 18 44Z" fill="${colors.primary}" stroke="#fff" stroke-width="3"/><circle cx="18" cy="17.5" r="5.5" fill="#fff"/></svg>`;

/**
 * A page with a Leaflet map on OpenStreetMap tiles: a tap drops the pin, the pin drags, and each
 * pick is posted to the app (`FromMap`); the app moves the pin with `ToMap`. The same page runs
 * in an iframe on web and in a WebView on Android. Leaflet comes from unpkg, pinned by its
 * integrity hash.
 */
export function mapHtml(initial: LatLng | undefined) {
  const start = initial ? { ...initial, zoom: POINT_ZOOM } : START;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<style>html, body, #map { margin: 0; height: 100%; background: ${colors.ground}; }</style>
</head>
<body>
<div id="map"></div>
<script>
(function () {
  function send(message) {
    var text = JSON.stringify(message);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(text);
    else window.parent.postMessage(text, '*');
  }
  if (!window.L) return send({ type: 'failed' });
  var map = L.map('map', { attributionControl: false }).setView([${start.lat}, ${start.lng}], ${start.zoom});
  L.control.attribution({ prefix: false }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  }).addTo(map);
  var icon = L.divIcon({ html: ${JSON.stringify(PIN)}, className: '', iconSize: [36, 46], iconAnchor: [18, 44] });
  var pin = null;
  function picked() {
    var p = pin.getLatLng();
    send({ type: 'pick', lat: p.lat, lng: p.lng });
  }
  function put(latLng) {
    if (pin) return pin.setLatLng(latLng);
    pin = L.marker(latLng, { icon: icon, draggable: true, keyboard: false }).addTo(map);
    pin.on('dragend', picked);
  }
  ${initial ? `put([${initial.lat}, ${initial.lng}]);` : ''}
  map.on('click', function (e) {
    put(e.latlng);
    picked();
  });
  function receive(event) {
    var m;
    try { m = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch (e) { return; }
    if (!m) return;
    if (m.type === 'show') {
      put([m.lat, m.lng]);
      map.setView([m.lat, m.lng], ${POINT_ZOOM});
    } else if (m.type === 'clear' && pin) {
      map.removeLayer(pin);
      pin = null;
    }
  }
  window.addEventListener('message', receive);
  document.addEventListener('message', receive);
  send({ type: 'ready' });
})();
</script>
</body>
</html>`;
}

/** A message from the map page, or undefined for anything else posted to the window. */
export function parseFromMap(data: unknown): FromMap | undefined {
  if (typeof data !== 'string') return undefined;
  try {
    const m = JSON.parse(data) as FromMap;
    if (m.type === 'ready' || m.type === 'failed') return m;
    if (m.type === 'pick' && Number.isFinite(m.lat) && Number.isFinite(m.lng)) return m;
  } catch {
    // Not ours.
  }
  return undefined;
}
