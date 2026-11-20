import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { expect, test } from 'vitest';

// Guards our expo-router patch (patches/expo-router@58.0.26.patch, routingQueueContext.js). The
// bridge is loaded with Node's own require, its React Native imports stubbed and its layout
// effect captured, so the test runs each mount and cleanup by hand in the order Android used.
const routerDir = dirname(createRequire(import.meta.url).resolve('expo-router/package.json'));
const load = createRequire(`${routerDir}/build/global-state/router.js`);
const effects: (() => () => void)[] = [];
Object.assign(globalThis, { __DEV__: false });
const stub = (name: string, exports: object) => {
  const filename = load.resolve(name);
  load.cache[filename] = { id: filename, filename, loaded: true, exports } as NodeJS.Module;
};
stub('react-native', { Platform: { OS: 'android' } });
stub('expo-linking', {});
stub('expo/dom', {});
stub('../react-navigation/core/useClientLayoutEffect', {
  useClientLayoutEffect: (effect: () => () => void) => effects.push(effect),
});
const { ImperativeRoutingQueueBridge } = load('./routingQueueContext.js');
const { router, unboundRouter } = load('./router.js');

/** Mounts a bridge (one navigation root) and returns its unmount. */
function mount() {
  ImperativeRoutingQueueBridge({ enqueue: () => {}, setTransitionMode: () => {} });
  return effects.pop()!();
}

test('the router stays bound when a recreated activity mounts its root before the old one unmounts', () => {
  const unmountOld = mount();
  const unmountNew = mount();
  unmountOld();
  expect(router.push).not.toBe(unboundRouter.push);
  unmountNew();
  expect(router.push).toBe(unboundRouter.push);
});
