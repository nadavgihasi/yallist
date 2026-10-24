// Types for the linked resources this package reads. SST's generated sst-env.d.ts isn't
// committed, so CI type-checks against this instead.
import 'sst';

declare module 'sst' {
  export interface Resource {
    Database: { endpoint: string; region: string };
  }
}
