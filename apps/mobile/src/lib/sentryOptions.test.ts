import { describe, expect, test, vi } from 'vitest';

vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '1.0.0' } } }));

const { errorContext } = await import('./sentryOptions');

describe('errorContext', () => {
  test('sends the component stack the boundary put on the error, also as its cause', () => {
    const error = Object.assign(new Error('boom'), { componentStack: '\n    at PastTripRow' });
    expect(errorContext(error)).toEqual({
      contexts: { react: { componentStack: '\n    at PastTripRow' } },
    });
    expect(error.cause).toBeInstanceOf(Error);
    expect((error.cause as Error).stack).toContain('at PastTripRow');
  });

  test('sends nothing extra without a component stack', () => {
    expect(errorContext(new Error('boom'))).toBeUndefined();
    expect(errorContext('boom')).toBeUndefined();
  });
});
