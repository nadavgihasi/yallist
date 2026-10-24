// Types for the linked resources this package reads. SST's generated sst-env.d.ts isn't
// committed, so CI type-checks against this instead.
import 'sst';

declare module 'sst' {
  export interface Resource {
    Api: { url: string };
    App: { name: string; stage: string };
    BetterAuthSecret: { value: string };
    Database: { endpoint: string; region: string };
    GithubFeedbackToken: { value: string };
    GoogleClientSecret: { value: string };
    Realtime: { http: string };
    Web: { url: string };
  }
}
