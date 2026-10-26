import * as Sentry from '@sentry/react-native';

import { dsn, options } from './sentryOptions';

// Android. Web loads a lighter SDK on demand (sentry.web.ts).
if (dsn) Sentry.init(options);

/** The root layout, with Sentry's error boundary and touch tracking; as it is without a DSN. */
export const withSentry: typeof Sentry.wrap = dsn ? Sentry.wrap : (root) => root;
