/**
 * i18n Constants — NightCRM
 *
 * Locale-independent constants for i18n configuration.
 * Extracted from request.ts to avoid ESM import issues in tests.
 */

export const SUPPORTED_LOCALES = ['fr', 'en', 'es', 'nl', 'de', 'it', 'sv'] as const;
export const DEFAULT_LOCALE = 'fr';
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isValidLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

/**
 * Parses an Accept-Language header and returns the best matching supported locale.
 *
 * Matching strategy (in order):
 * 1. Exact match (e.g. "fr" → "fr")
 * 2. Language-prefix match (e.g. "fr-FR" → "fr", "en-US" → "en")
 *
 * @param header - The raw Accept-Language header value
 * @param supported - List of supported locale codes
 * @returns The best matching locale, or null if none match
 */
export function matchLocaleFromAcceptLanguage(
  header: string,
  supported: readonly string[] = SUPPORTED_LOCALES,
): string | null {
  if (!header) return null;

  const parsed = header
    .split(',')
    .map((part) => {
      const [lang = '', qStr = ''] = part.trim().split(';q=');
      const quality = qStr ? parseFloat(qStr) : 1;
      return { lang: lang.trim().toLowerCase(), quality };
    })
    .filter((entry) => entry.lang.length > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { lang } of parsed) {
    // Exact match
    if (supported.includes(lang)) return lang;

    // Prefix match (e.g. "fr-fr" → "fr")
    const prefix = lang.split('-')[0];
    if (prefix && supported.includes(prefix)) return prefix;
  }

  return null;
}
