import bring from './bring';
import buy from './buy';
import english from './english';

/** The data files, each parsed by `parseCatalog`. */
export const CATALOG_SOURCES: string[] = [buy, bring];

/** English names of common items, parsed by `parseEnglishNames`. */
export const CATALOG_ENGLISH: string = english;
