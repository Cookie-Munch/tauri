/**
 * Minimal STRUCTURAL types for the small slice of `@tauri-apps/plugin-store` this SDK
 * touches.
 *
 * We deliberately do NOT `import` (not even `import type`) from any `@tauri-apps/*`
 * package: this SDK must build and type-check with NO `@tauri-apps/*` package installed,
 * and Tauri must stay out of the dependency graph. The plugin's real `Store` object and
 * its `load()` factory satisfy these interfaces duck-typed, so callers pass them straight
 * through with no casts.
 */

/** Subset of the plugin-store `Store` used to read/write a single consent blob. */
export interface TauriStoreLike {
  get<T = unknown>(key: string): Promise<T | undefined | null>;
  set(key: string, value: unknown): Promise<void>;
  /** Persist pending changes to disk. Some builds autosave; calling it is always safe. */
  save?(): Promise<void>;
  delete?(key: string): Promise<boolean | void>;
}

/** The pieces of `@tauri-apps/plugin-store` the default secure store lazily loads. */
export interface TauriStoreModule {
  /** Load (or create) a persisted store file, returning a {@link TauriStoreLike}. */
  load(path: string, options?: unknown): Promise<TauriStoreLike>;
}
