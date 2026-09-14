import { describe, it, expect, vi } from 'vitest';
import {
  memoryStore,
  localStorageStore,
  tauriStoreStore,
  type WebStorageLike,
} from '../src/secure-store.js';
import type { TauriStoreLike, TauriStoreModule } from '../src/tauri-types.js';

describe('memoryStore', () => {
  it('round-trips a value', async () => {
    const s = memoryStore();
    expect(await s.read()).toBeNull();
    await s.write('hello');
    expect(await s.read()).toBe('hello');
  });
});

describe('localStorageStore', () => {
  function fakeLocalStorage(): WebStorageLike {
    const map = new Map<string, string>();
    return {
      getItem: (k) => (map.has(k) ? map.get(k)! : null),
      setItem: (k, v) => { map.set(k, v); },
    };
  }

  it('persists to the injected Web Storage', async () => {
    const ls = fakeLocalStorage();
    const s = localStorageStore({ storage: ls, key: 'cm' });
    await s.write('{"marketing":true}');
    expect(ls.getItem('cm')).toBe('{"marketing":true}');
    expect(await s.read()).toBe('{"marketing":true}');
  });

  it('falls back to in-memory when Web Storage throws on access', async () => {
    const throwing: WebStorageLike = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    const s = localStorageStore({ storage: throwing });
    // does not throw; behaves as an in-memory store
    await s.write('x');
    expect(await s.read()).toBe('x');
  });
});

describe('tauriStoreStore', () => {
  function fakePlugin() {
    const data = new Map<string, unknown>();
    let saves = 0;
    const store: TauriStoreLike = {
      get: vi.fn(async <T,>(k: string) => data.get(k) as T | undefined),
      set: vi.fn(async (k: string, v: unknown) => { data.set(k, v); }),
      save: vi.fn(async () => { saves += 1; }),
    };
    const plugin: TauriStoreModule = {
      load: vi.fn(async (_path: string) => store),
    };
    return { plugin, store, data, saves: () => saves };
  }

  it('reads/writes the consent blob via an injected plugin (no @tauri-apps dep)', async () => {
    const { plugin, data } = fakePlugin();
    const s = tauriStoreStore({ plugin, path: 'cookiemunch.json', key: 'consent' });
    expect(await s.read()).toBeNull();
    await s.write('{"marketing":true}');
    expect(data.get('consent')).toBe('{"marketing":true}');
    expect(await s.read()).toBe('{"marketing":true}');
  });

  it('calls save() after a write', async () => {
    const { plugin, saves } = fakePlugin();
    const s = tauriStoreStore({ plugin });
    await s.write('x');
    expect(saves()).toBe(1);
  });

  it('accepts a pre-loaded store instance', async () => {
    const data = new Map<string, unknown>();
    const store: TauriStoreLike = {
      get: async (k) => data.get(k),
      set: async (k, v) => { data.set(k, v); },
    };
    const s = tauriStoreStore({ store });
    await s.write('y');
    expect(await s.read()).toBe('y');
  });
});
