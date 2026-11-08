import { useEffect, useEffectEvent, useImperativeHandle, useRef, useState } from 'react';

import { mapHtml, parseFromMap, type ToMap } from './mapHtml';
import type { MapFrameProps } from './types';

/**
 * The map page in a sandboxed iframe: scripts run, but in an opaque origin, with no access to the
 * app's page or storage. Messages go both ways with postMessage.
 */
export function MapFrame({ initial, onMessage, ref, label }: MapFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  // Built once: a new srcdoc would reload the map.
  const [html] = useState(() => mapHtml(initial));
  const ready = useRef(false);
  const pending = useRef<ToMap | undefined>(undefined);

  const post = (m: ToMap) => frame.current?.contentWindow?.postMessage(JSON.stringify(m), '*');
  useImperativeHandle(ref, () => ({
    send: (m) => (ready.current ? post(m) : (pending.current = m)),
  }));

  const receive = useEffectEvent((event: MessageEvent) => {
    if (event.source !== frame.current?.contentWindow) return;
    const m = parseFromMap(event.data);
    if (!m) return;
    if (m.type === 'ready') {
      ready.current = true;
      if (pending.current) post(pending.current);
      pending.current = undefined;
    }
    onMessage(m);
  });
  useEffect(() => {
    const listener = (event: MessageEvent) => receive(event);
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);

  return (
    <iframe
      ref={frame}
      srcDoc={html}
      title={label}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      style={{ border: 0, width: '100%', height: '100%', display: 'block' }}
    />
  );
}
