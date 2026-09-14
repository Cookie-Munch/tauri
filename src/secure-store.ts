/**
 * Pluggable persistence for the consent decision. Mirrors the Electron / React Native
 * SDKs' injectable store: the ConsentManager reads/writes a single opaque string and does
 * not care how it is stored, so tests inject an in-memory store, browser-only Tauri
 * webviews use {@link localStorageStore}, and apps that want an OS-backed file use
 * {@link tauriStoreStore} (the Tauri store plugin).
 */

import type { TauriStoreLike, TauriStoreModule } from './tauri-types.js';

/** A minimal string-blob store. Sync or async is fine. */
export interface SecureStore {
  read(): string | null | Promise<string | null>;
  write(value: string): void | Promise<void>;
}

/** An always-in-memory store — handy for tests and headless usage. */
export function memoryStore(): SecureStore {
  let value: string | null = null;
  return {
    read: () => value,
    write: (v) => {
      value = v;
    },
  };
}

/** Minimal structural view of the Web Storage API (localStorage / sessionStorage). */
export interface WebStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface LocalStorageStoreOptions {
  /** The storage key. Defaults to `cookiemunch-consent`. */
  key?: string;
  /**
   * The backing Web Storage. Defaults to `globalThis.localStorage`. Pass `sessionStorage`
   * or a mock explicitly. If none is available the store degrades to in-memory.
   */
  storage?: WebStorageLike;
}

/**
 * The default webview store: persists the consent blob in the webview's `localStorage`.
 * Access is guarded (private-mode webviews can throw), and it transparently falls back to
 * an in-memory store when Web Storage is unavailable.
 */
export function localStorageStore(opts: LocalStorageStoreOptions = {}): SecureStore {
  const key = opts.key ?? 'cookiemunch-consent';
  const g = globalThis as { localStorage?: WebStorageLike };
  let storage: WebStorageLike | null = opts.storage ?? g.localStorage ?? null;
  // Verify the storage is actually usable — some webviews expose it but throw on access.
  if (storage) {
    try {
      storage.getItem(key);
    } catch {
      storage = null;
    }
  }
  if (!storage) return memoryStore();
  const ls = storage;
  return {
    read() {
      try {
        return ls.getItem(key);
      } catch {
        return null;
      }
    },
    write(value) {
      try {
        ls.setItem(key, value);
      } catch {
        /* quota / private mode — the ledger sync still captured the decision */
      }
    },
  };
}

export interface TauriStoreStoreOptions {
  /**
   * The Tauri store module (`{ load }` from `@tauri-apps/plugin-store`). Optional: when
   * omitted it is loaded lazily via `import('@tauri-apps/plugin-store')` on first use, so
   * importing this file never requires any `@tauri-apps/*` package to be installed. Pass
   * it explicitly to avoid the dynamic import (or in tests).
   */
  plugin?: TauriStoreModule;
  /** An already-loaded {@link TauriStoreLike}. Overrides `plugin` + `path`. */
  store?: TauriStoreLike;
  /** The store file path (relative to the app data dir). Defaults to `cookiemunch.json`. */
  path?: string;
  /** The key the consent blob is stored under. Defaults to `consent`. */
  key?: string;
}

/**
 * An OS-backed store built on Tauri's official `@tauri-apps/plugin-store`. The consent
 * blob is written to a JSON store file in the app's data directory (managed by the Rust
 * side of the plugin), surviving restarts.
 *
 * `@tauri-apps/plugin-store` is loaded lazily via an indirect specifier so this SDK
 * builds and type-checks with NO `@tauri-apps/*` package installed. At runtime (inside a
 * Tauri app) the plugin is present. The app must register the store plugin on the Rust
 * side (`tauri_plugin_store`) and grant the `store:*` capability.
 */
export function tauriStoreStore(opts: TauriStoreStoreOptions = {}): SecureStore {
  const path = opts.path ?? 'cookiemunch.json';
  const key = opts.key ?? 'consent';
  let resolved: Promise<TauriStoreLike> | null = null;

  async function resolve(): Promise<TauriStoreLike> {
    if (resolved) return resolved;
    resolved = (async () => {
      if (opts.store) return opts.store;
      // Indirect specifier: keeps the compiler/bundler from statically resolving
      // '@tauri-apps/plugin-store', so this package builds and type-checks WITHOUT it.
      // At runtime (inside a Tauri app) the module is always present.
      const specifier = '@tauri-apps/plugin-store';
      const plugin = opts.plugin ?? ((await import(specifier)) as unknown as TauriStoreModule);
      return plugin.load(path);
    })();
    return resolved;
  }

  return {
    async read() {
      const store = await resolve();
      const value = await store.get<string>(key);
      return typeof value === 'string' ? value : null;
    },
    async write(value) {
      const store = await resolve();
      await store.set(key, value);
      if (store.save) await store.save();
    },
  };
}
