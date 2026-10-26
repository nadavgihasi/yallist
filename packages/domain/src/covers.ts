import type { TemplateId } from './types';

/** The illustrated covers a trip can have, in picker order (apps/mobile `Cover`). */
export const COVER_IDS = [
  'camp',
  'beach',
  'desert',
  'forest',
  'zimmer',
  'trail',
  'city',
  'picnic',
  'winter',
  'flight',
] as const;
export type CoverId = (typeof COVER_IDS)[number];

const DEFAULT_COVERS: Record<TemplateId, CoverId> = {
  camp: 'camp',
  grill: 'picnic',
  zimmer: 'zimmer',
  beach: 'beach',
  blank: 'trail',
};

/** The cover a trip gets from its template until someone picks another. */
export const coverFor = (template: TemplateId): CoverId => DEFAULT_COVERS[template];
