import { describe, it, expect, vi } from 'vitest';
import { createConsentManager } from '../src/manager.js';
import { createConsentGate, type ConsentSource } from '../src/gate.js';
import type { SecureStore } from '../src/secure-store.js';

function memStore(): SecureStore {
  let value: string | null = null;
  return { read: () => value, write: (v) => { value = v; } };
}

describe('gate via ConsentManager', () => {
  it('runs fn only AFTER consent is granted (prior-blocking equivalent)', async () => {
    const manager = createConsentManager({ cbid: 'demo', storage: memStore() });
    await manager.load();

    const initAnalytics = vi.fn();
    manager.gate('statistics', initAnalytics);
    expect(initAnalytics).not.toHaveBeenCalled(); // no consent yet

    await manager.accept();
    expect(initAnalytics).toHaveBeenCalledTimes(1);
  });

  it('runs fn immediately when consent is already granted', async () => {
    const manager = createConsentManager({ cbid: 'demo', storage: memStore() });
    await manager.load();
    await manager.accept();

    const initPixel = vi.fn();
    manager.gate('marketing', initPixel);
    // let the microtask that reads getState() flush
    await Promise.resolve();
    expect(initPixel).toHaveBeenCalledTimes(1);
  });

  it('runs fn at most once even across multiple grants', async () => {
    const manager = createConsentManager({ cbid: 'demo', storage: memStore() });
    await manager.load();

    const fn = vi.fn();
    manager.gate('statistics', fn);
    await manager.accept();
    await manager.set({ preferences: true, statistics: true, marketing: false });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('a still-pending gate can be cancelled', async () => {
    const manager = createConsentManager({ cbid: 'demo', storage: memStore() });
    await manager.load();

    const fn = vi.fn();
    const cancel = manager.gate('statistics', fn);
    cancel();
    await manager.accept();
    expect(fn).not.toHaveBeenCalled();
  });

  it('necessary is always granted', async () => {
    const manager = createConsentManager({ cbid: 'demo', storage: memStore() });
    await manager.load();
    await expect(manager.isConsented('necessary')).resolves.toBe(true);
    await expect(manager.isConsented('statistics')).resolves.toBe(false);
  });

  it('createConsentGate works over any ConsentSource', async () => {
    let state = {
      necessary: true as const,
      preferences: false,
      statistics: false,
      marketing: false,
      method: 'implied' as const,
      stamp: 's',
      ver: 1,
      utc: 0,
      region: 'gb',
    };
    const listeners = new Set<(s: typeof state) => void>();
    const source: ConsentSource = {
      getState: () => state,
      onChange: (cb) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
    };
    const gate = createConsentGate(source);
    const fn = vi.fn();
    gate.gate('marketing', fn);
    expect(fn).not.toHaveBeenCalled();

    state = { ...state, marketing: true };
    for (const cb of listeners) cb(state);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
