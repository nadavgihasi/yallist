/**
 * Lets the UI tests (`apps/mobile/e2e`) find an element with `id:` on every platform. Android
 * and iOS expose `testID`; on web Maestro reads the DOM `id` before `aria-label`, so it goes
 * there too.
 */
export const testId = (id: string | undefined) => ({ testID: id, id });
