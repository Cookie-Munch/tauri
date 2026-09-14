/**
 * Core consent shapes for the Tauri SDK. These deliberately MIRROR
 * @cookiemunch/electron's and @cookiemunch/react-native's Choices/ConsentState/
 * ConsentMethod so every Cookie Munch SDK feels identical: same three opt-in
 * categories, same explicit/implied method, and the same stamp/ver/utc/region
 * envelope that the tamper-evident ledger records.
 */

/** How a decision was obtained: an explicit user action, or an implied default. */
export type ConsentMethod = 'explicit' | 'implied';

/** The three opt-in consent categories (necessary is always granted). */
export type OptInCategory = 'preferences' | 'statistics' | 'marketing';

/** Any addressable consent category, including the always-on `necessary`. */
export type ConsentCategory = 'necessary' | OptInCategory;

/** The user-controllable opt-in choices. */
export interface Choices {
  preferences: boolean;
  statistics: boolean;
  marketing: boolean;
}

/** The full, persisted consent state — choices plus the audit envelope. */
export interface ConsentState extends Choices {
  /** Necessary cookies/SDKs are always permitted; this is invariably true. */
  necessary: true;
  method: ConsentMethod;
  /** Stable per-decision id echoed to the ledger (the consent-receipt stamp). */
  stamp: string;
  /** Schema/decision version. */
  ver: number;
  /** Epoch millis the decision was made. */
  utc: number;
  /** Best-effort region hint sent with the record. */
  region: string;
}
