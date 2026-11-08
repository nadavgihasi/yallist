import type { LatLng } from '@yallist/domain';
import type { Ref } from 'react';

import type { FromMap, ToMap } from './mapHtml';

export type MapHandle = { send: (message: ToMap) => void };

export type MapFrameProps = {
  /** Where the pin starts; the map opens on Israel without one. */
  initial: LatLng | undefined;
  onMessage: (message: FromMap) => void;
  ref?: Ref<MapHandle>;
  /** What screen readers call the map. */
  label: string;
};
