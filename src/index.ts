/**
 * @cookiemunch/tauri — the Cookie Munch SDK for Tauri desktop apps (the webview / JS side).
 *
 * Gives a Tauri app the same consent capture + gating + auditable ledger record as the
 * web embed and the Electron / React Native SDKs. A Tauri webview is a single JS context
 * (no main/renderer/IPC split), so it's simpler than the Electron SDK:
 *
 *   const consent = createConsentManager({ apiKey, cbid, baseUrl, region });
 *   await consent.load();
 *   consent.gate('statistics', () => initAnalytics()); // prior-blocking equivalent
 *
 * No `@tauri-apps/*` package is imported statically anywhere here. The optional Tauri
 * store plugin is loaded lazily, so this package builds and type-checks with NO
 * `@tauri-apps/*` package installed.
 */

// Types
export type {
  Choices,
  ConsentState,
  ConsentMethod,
  ConsentCategory,
  OptInCategory,
} from './types.js';

// Webview consent manager
export { createConsentManager } from './manager.js';
export type { ConsentManager, ConsentManagerOptions } from './manager.js';

// Persistence
export { memoryStore, localStorageStore, tauriStoreStore } from './secure-store.js';
export type {
  SecureStore,
  WebStorageLike,
  LocalStorageStoreOptions,
  TauriStoreStoreOptions,
} from './secure-store.js';

// Ledger API client
export { createConsentApiClient } from './api.js';
export type { ConsentApiClient, ConsentApiClientOptions, ConsentRecordPayload } from './api.js';

// Gating (prior-blocking equivalent)
export { createConsentGate } from './gate.js';
export type { ConsentGate, ConsentSource } from './gate.js';

// Tauri structural types (no @tauri-apps import required to consume them)
export type { TauriStoreLike, TauriStoreModule } from './tauri-types.js';

// The full typed REST client, re-exported for Tauri dashboards/reads.
export { createCookieMunch, CookieMunchApiError } from '@cookiemunch/sdk';
export type { CookieMunchClient, CookieMunchOptions } from '@cookiemunch/sdk';
