/**
 * Locale-aware formatting helpers for client-side code.
 *
 * Most CRM formatting happens inside module-level helper functions and
 * data services that cannot call React hooks (`useFormatter`/`useLocale`).
 * This module holds the active locale in a client-side store that
 * NightCRMIntlProvider syncs from its `locale` prop (the same value the
 * `useLocale()` hook returns), so every helper below formats according to
 * the locale the user selected — not a hardcoded 'fr-FR'.
 *
 * The store defaults to DEFAULT_LOCALE ('fr'): Jest tests without a provider
 * keep the pre-i18n French formatting, and the provider syncs the store in an
 * effect, i.e. only in the browser and only after the provider has mounted.
 *
 * SSR caveat: a client component that is server-rendered with server-fed data
 * must NOT read this store. Effects never run on the server, so the store is
 * always 'fr' there, and the server HTML then mismatches the client's first
 * render in every other locale. Such components take the locale from
 * useLocale() and pass it to their formatter. Never call setActiveLocale()
 * while rendering: server module state is shared between requests.
 */

import { DEFAULT_LOCALE } from './constants';

// ─── Active-locale store ─────────────────────────────────────────────────

let activeLocale: string = DEFAULT_LOCALE;

/** Set the active locale (called by NightCRMIntlProvider). */
export function setActiveLocale(locale: string): void {
  activeLocale = locale;
}

/** The active UI locale (e.g. 'fr', 'en'). */
export function currentLocale(): string {
  return activeLocale;
}

// ─── Intl factory helpers ────────────────────────────────────────────────

/** An Intl.NumberFormat bound to the active locale. */
export function numberFormat(opts?: Intl.NumberFormatOptions): Intl.NumberFormat {
  return new Intl.NumberFormat(activeLocale, opts);
}

/** An Intl.DateTimeFormat bound to the active locale. */
export function dateTimeFormat(opts?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(activeLocale, opts);
}

// ─── Date/number formatting shortcuts ────────────────────────────────────

type DateInput = Date | string | number;

/** Format a date with toLocaleDateString for the active locale. */
export function formatDate(d: DateInput, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(d).toLocaleDateString(activeLocale, opts);
}

/** Format a time with toLocaleTimeString for the active locale. */
export function formatTime(d: DateInput, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(d).toLocaleTimeString(activeLocale, opts);
}

/** Format a date + time with toLocaleString for the active locale. */
export function formatDateTime(d: DateInput, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(d).toLocaleString(activeLocale, opts);
}
