import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { View } from 'react-native';

/** Web OAuth client ID for this stage (infra/app/sst.config.ts). */
const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

interface GoogleIdentity {
  initialize(config: { client_id: string; callback: (r: { credential: string }) => void }): void;
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

let gis: Promise<GoogleIdentity> | undefined;
function loadGis() {
  gis ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client?hl=he';
    script.async = true;
    script.onload = () => resolve(window.google!.accounts.id);
    script.onerror = () => {
      gis = undefined;
      reject(new Error('Google Identity Services failed to load'));
    };
    document.head.appendChild(script);
  });
  return gis;
}

/**
 * Google's own "Continue with Google" button (Google Identity Services). It hands back an ID
 * token, which Better Auth verifies and exchanges for a session; no redirects.
 */
export function GoogleButton({ onIdToken }: { onIdToken: (idToken: string) => void }) {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const callback = useRef(onIdToken);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    callback.current = onIdToken;
  });

  useEffect(() => {
    if (!CLIENT_ID || width === 0) return;
    let cancelled = false;
    loadGis()
      .then((id) => {
        if (cancelled || !ref.current) return;
        id.initialize({ client_id: CLIENT_ID, callback: (r) => callback.current(r.credential) });
        // On web, a View's ref is its DOM element.
        id.renderButton(ref.current as unknown as HTMLElement, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          locale: 'he',
          width: Math.min(400, Math.round(width)),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [width]);

  if (!CLIENT_ID) return null;
  return (
    <View
      ref={ref}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ minHeight: 44, alignItems: 'center' }}
    />
  );
}
