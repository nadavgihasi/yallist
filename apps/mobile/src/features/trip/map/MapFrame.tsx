import * as Linking from 'expo-linking';
import { useImperativeHandle, useRef, useState, type ComponentType, type Ref } from 'react';
import { WebView, type WebViewProps } from 'react-native-webview';

import { mapHtml, parseFromMap, type ToMap } from './mapHtml';
import type { MapFrameProps } from './types';

// react-native-webview types its props as `WebViewProps & P` with P = undefined, which current
// TypeScript reduces to never; this is the same component with its props as meant.
const Web = WebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebView> }>;

/**
 * The map page in a WebView. Links in it (the OpenStreetMap credit) open in the browser, not in
 * the map. "Yallist" in the user agent names the app to the tile servers, as their policy asks.
 */
export function MapFrame({ initial, onMessage, ref, label }: MapFrameProps) {
  const view = useRef<WebView>(null);
  // Built once: a new source would reload the map.
  const [html] = useState(() => mapHtml(initial));
  const ready = useRef(false);
  const pending = useRef<ToMap | undefined>(undefined);

  const post = (m: ToMap) =>
    view.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(JSON.stringify(m))} })); true;`,
    );
  useImperativeHandle(ref, () => ({
    send: (m) => (ready.current ? post(m) : (pending.current = m)),
  }));

  return (
    <Web
      ref={view}
      source={{ html }}
      originWhitelist={['*']}
      accessibilityLabel={label}
      applicationNameForUserAgent="Yallist"
      nestedScrollEnabled
      setSupportMultipleWindows={false}
      onShouldStartLoadWithRequest={(request) => {
        if (request.url === 'about:blank' || request.url.startsWith('data:')) return true;
        void Linking.openURL(request.url);
        return false;
      }}
      onMessage={(event) => {
        const m = parseFromMap(event.nativeEvent.data);
        if (!m) return;
        if (m.type === 'ready') {
          ready.current = true;
          if (pending.current) post(pending.current);
          pending.current = undefined;
        }
        onMessage(m);
      }}
    />
  );
}
