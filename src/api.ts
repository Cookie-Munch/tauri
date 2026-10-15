/**
 * Consent-record API client. Each decision is POSTed to the Cookie Munch public
 * consent-ingest endpoint (`POST /api/v1/consent`) so it lands in the tamper-evident,
 * hash-chained ledger — exactly as the web embed, the Electron SDK, and the React Native
 * SDK do.
 *
 * We build on @cookiemunch/sdk: its `CookieMunchApiError` is thrown on a non-2xx
 * response, and the full typed REST client (`createCookieMunch`) is re-exported from the
 * package root for Tauri apps that also need to read stats/logs/receipts.
 */

import { CookieMunchApiError } from '@cookiemunch/sdk';
import type { Choices, ConsentMethod } from './types.js';

/** The wire payload for a single consent record. Mirrors the embed/Electron/RN ingest body. */
export interface ConsentRecordPayload {
  cbid: string;
  stamp: string;
  choices: Choices;
  method: ConsentMethod;
  ver: number;
  utc: number;
  url: string;
  region: string;
  /**
   * Optional, app-supplied STABLE cross-surface subject id (e.g. a logged-in account id).
   * Lets an org correlate one subject's consent across web + mobile + desktop. Sent only
   * when present; omitted → the body is byte-identical to before this field existed.
   */
  subjectId?: string;
}

/** Anything that can persist a consent decision to the ledger. Injectable for tests. */
export interface ConsentApiClient {
  recordConsent(payload: ConsentRecordPayload): Promise<void>;
}

export interface ConsentApiClientOptions {
  /** API origin, "https://api.cookiemunch.net". `/api/v1/consent` is appended. */
  baseUrl: string;
  /**
   * Optional Developer API key. When present it is sent as a Bearer token. The public
   * ingest endpoint does not require it, so it is safe to omit for a browser webview.
   */
  apiKey?: string;
  /** Injectable for tests / custom runtimes. Defaults to the global fetch. */
  fetch?: typeof fetch;
}

/**
 * The default {@link ConsentApiClient}. It never persists locally — that is the
 * ConsentManager's job — it only ships the record to the ledger.
 */
export function createConsentApiClient(opts: ConsentApiClientOptions): ConsentApiClient {
  const base = opts.baseUrl.replace(/\/+$/, '');
  const doFetch = opts.fetch ?? globalThis.fetch;
  if (!doFetch) {
    throw new Error('No fetch available; pass { fetch } in ConsentApiClientOptions.');
  }
  return {
    async recordConsent(payload) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-CookieMunch-Region': payload.region,
      };
      if (opts.apiKey) headers['Authorization'] = `Bearer ${opts.apiKey}`;
      const res = await doFetch(`${base}/api/v1/consent`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        let message = `consent ingest failed with status ${res.status}`;
        try {
          const data = (await res.json()) as { error?: string };
          if (typeof data.error === 'string') message = data.error;
        } catch {
          /* non-JSON error body — keep the default message */
        }
        throw new CookieMunchApiError(res.status, message);
      }
    },
  };
}
