# @cookiemunch/tauri

Cookie Munch SDK for **Tauri** desktop apps. A Tauri app is a Rust backend plus a webview
frontend (HTML/JS/DOM). This package is the **frontend (TypeScript) SDK** — it runs inside
the webview and gives your app the same three things the web embed gives a website:

1. **Consent capture** — an implied default until the user decides, then an explicit
   accept / decline / custom decision.
2. **An auditable ledger record** — every decision is POSTed to the Cookie Munch API
   (`POST /api/v1/consent`, via [`@cookiemunch/sdk`](../sdk)) so it lands in the
   tamper-evident, hash-chained consent log.
3. **Gating** — the desktop equivalent of prior-blocking: analytics/telemetry SDKs are
   initialized **only after** the relevant consent category is granted.

Unlike [`@cookiemunch/electron`](../electron), a Tauri webview is a **single JS context**
— there is no main/renderer/IPC split, so the whole manager lives in the webview and the
API is simpler.

The API mirrors [`@cookiemunch/electron`](../electron) and
[`@cookiemunch/react-native`](../react-native) so every Cookie Munch SDK feels identical
(`Choices`, `ConsentState`, `ConsentMethod`, load/set/accept/decline, `onChange`,
pluggable storage).

## Install

```bash
pnpm add @cookiemunch/tauri
```

`@tauri-apps/plugin-store` is an **optional peer dependency**. This package builds and
type-checks with **no `@tauri-apps/*` package installed** — you only need the store plugin
if you opt into `tauriStoreStore()`.

## Usage (in the webview)

```ts
import { createConsentManager } from '@cookiemunch/tauri';

const consent = createConsentManager({
  apiKey: 'fck_…',                  // optional; sent as a Bearer token on ledger writes
  cbid: 'YOUR_SITE_ID',            // your Cookie Munch site id
  baseUrl: 'https://api.cookiemunch.net', // omit to disable ledger sync
  region: 'gb',
  // storage defaults to localStorageStore() (the webview's localStorage)
});

// Restore any prior decision on startup.
await consent.load();

// Wire up your banner buttons.
acceptBtn.onclick = () => consent.accept();
declineBtn.onclick = () => consent.decline();
saveBtn.onclick   = () => consent.set({ preferences: true, statistics: false, marketing: true });

// React to changes.
consent.onChange((state) => render(state));
```

## Gate your telemetry (prior-blocking equivalent)

Do **not** initialize an analytics/telemetry SDK at startup. Gate it behind consent, so it
only ever runs after the user opts in — the desktop equivalent of the web embed's
prior-blocking.

```ts
// Runs exactly once, the moment `statistics` consent is (or becomes) granted:
consent.gate('statistics', () => {
  posthog.init('…');
});

consent.gate('marketing', () => initMetaPixel());
```

`gate(category, fn)` (and its alias `whenConsented`) runs `fn` immediately if consent is
already granted, otherwise on the first change that grants it — and never more than once.
It returns an unsubscribe function to cancel a still-pending gate. `isConsented(category)`
returns the current boolean.

## Secure storage via the Tauri store plugin

By default the decision is persisted in the webview's `localStorage`. For an OS-backed
store file managed by the Rust side, use `tauriStoreStore()`, which wraps Tauri's official
[`@tauri-apps/plugin-store`](https://tauri.app/plugin/store/):

```ts
import { createConsentManager, tauriStoreStore } from '@cookiemunch/tauri';

const consent = createConsentManager({
  cbid: 'YOUR_SITE_ID',
  baseUrl: 'https://api.cookiemunch.net',
  storage: tauriStoreStore({ path: 'cookiemunch.json', key: 'consent' }),
});
```

The plugin is imported **lazily** — nothing forces `@tauri-apps/*` into your build graph
unless you actually call `tauriStoreStore()`. On the Rust side you must register the store
plugin and grant its capability:

```rust
// src-tauri/src/main.rs
tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::new().build())
    // …
```

```json
// src-tauri/capabilities/default.json
{ "permissions": ["store:default"] }
```

Available stores:

- `localStorageStore(options?)` — the default; the webview's `localStorage`, with a safe
  in-memory fallback for private-mode webviews.
- `tauriStoreStore(options?)` — OS-backed store file via `@tauri-apps/plugin-store`.
- `memoryStore()` — in-memory only (tests / headless).

You can also inject any custom `SecureStore` (`{ read(), write(value) }`).

## Reading the ledger

The full typed Developer API client is re-exported for in-app dashboards:

```ts
import { createCookieMunch } from '@cookiemunch/tauri';

const cm = createCookieMunch({ apiKey: 'fck_…', baseUrl: 'https://api.cookiemunch.net' });
const stats = await cm.consent.stats('YOUR_SITE_ID');
```

## Alternative: load the web embed directly

A Tauri webview is a real browser context, so you can skip this SDK entirely and load the
Cookie Munch web embed **`consent.js`** in your `index.html` exactly as you would on a
website:

```html
<script id="CookieConsent" src="https://cdn.cookiemunch.net/consent.js" data-cbid="YOUR_SITE_ID" async></script>
```

That gives you the full banner UI and DOM-level prior-blocking (rewriting `<script>` tags)
out of the box. Use this SDK instead when you want programmatic control of the decision,
native secure storage via the Tauri store plugin, or to gate non-DOM SDKs — and the two
can coexist (this SDK reads/writes the same three-category consent model).

## API

- `createConsentManager({ apiKey?, cbid, baseUrl?, storage?, region?, ver?, ... })` →
  `ConsentManager` — the webview owner of the decision. `load()`, `getState()`,
  `set(choices)`, `accept()`, `decline()`, `hasResponse()`, `onChange(cb)`, plus the gate
  methods `gate`/`whenConsented`/`isConsented`.
- `localStorageStore(options?)` / `tauriStoreStore(options?)` / `memoryStore()` —
  `SecureStore` implementations.
- `createConsentApiClient({ baseUrl, apiKey?, fetch? })` — the ledger POST client
  (injectable).
- `createConsentGate(source)` — build a gate over any consent source.
- `createCookieMunch(...)` / `CookieMunchApiError` — the full typed REST client
  (re-exported from `@cookiemunch/sdk`).

## Notes

- Offline-safe: a decision is always persisted locally first; a failed ledger POST is
  swallowed and never loses the decision.
- No `@tauri-apps/*` package is imported statically anywhere here; `@tauri-apps/plugin-store`
  is loaded lazily only when you use `tauriStoreStore()`, so it never forces Tauri into
  your build graph.
