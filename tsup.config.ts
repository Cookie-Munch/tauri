import { defineConfig } from 'tsup';

// `@tauri-apps/plugin-store` is an OPTIONAL peer dependency and is only ever loaded
// lazily at runtime (see src/secure-store.ts). Marking it external means esbuild never
// tries to resolve it at build time, so this package builds cleanly WITHOUT any
// `@tauri-apps/*` package installed.
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  external: ['@tauri-apps/plugin-store'],
});
