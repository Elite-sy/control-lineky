import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  isValidLocale,
  matchLocaleFromAcceptLanguage,
} from './constants';

/**
 * NightCRM i18n configuration for next-intl v4.
 *
 * Locale resolution priority:
 * 1. NEXT_LOCALE cookie (set by locale switcher)
 * 2. Accept-Language header (auto-detected from browser)
 * 3. Default: 'fr' (primary business locale)
 *
 * Supported locales: fr (default), en, es, nl, de, it, sv
 */
export { SUPPORTED_LOCALES, DEFAULT_LOCALE, isValidLocale, matchLocaleFromAcceptLanguage };

/**
 * Static import map for locale message files.
 * Using explicit import() calls per locale so webpack/turbopack can
 * statically analyze the dependency graph (no fully-dynamic template imports).
 */
const commonLoaders: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  fr: () => import('./locales/fr/common'),
  en: () => import('./locales/en/common'),
  es: () => import('./locales/es/common'),
  nl: () => import('./locales/nl/common'),
  de: () => import('./locales/de/common'),
  it: () => import('./locales/it/common'),
  sv: () => import('./locales/sv/common'),
};

const portalLoaders: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  fr: () => import('./locales/fr/portal'),
  en: () => import('./locales/en/portal'),
  es: () => import('./locales/es/portal'),
  nl: () => import('./locales/nl/portal'),
  de: () => import('./locales/de/portal'),
  it: () => import('./locales/it/portal'),
  sv: () => import('./locales/sv/portal'),
};

/**
 * Resolves the user's preferred locale.
 *
 * Priority:
 * 1. NEXT_LOCALE cookie (user explicit choice via language switcher)
 * 2. Accept-Language header (browser preference)
 * 3. DEFAULT_LOCALE ('fr')
 *
 * Returns a valid supported locale.
 */
async function resolveLocale(): Promise<string> {
  // 1. Check cookie (set by locale switcher)
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  if (cookieLocale && isValidLocale(cookieLocale)) {
    return cookieLocale;
  }

  // 2. Check Accept-Language header (browser preference)
  const headersList = await headers();
  const acceptLanguage = headersList.get('accept-language');
  if (acceptLanguage) {
    const matched = matchLocaleFromAcceptLanguage(acceptLanguage, SUPPORTED_LOCALES);
    if (matched && isValidLocale(matched)) {
      return matched;
    }
  }

  // 3. Fall back to default
  return DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();

  // Load both common (SaaS) and portal message files for the resolved locale.
  // They are merged so components can use useTranslations('app'),
  // useTranslations('portal.dashboard'), etc.
  const commonLoader = commonLoaders[locale] ?? commonLoaders[DEFAULT_LOCALE];
  const portalLoader = portalLoaders[locale] ?? portalLoaders[DEFAULT_LOCALE];

  if (!commonLoader || !portalLoader) {
    throw new Error(`Failed to load locale messages for "${locale}"`);
  }

  const [commonModule, portalModule] = await Promise.all([
    commonLoader(),
    portalLoader(),
  ]);

  const messages = {
    ...commonModule.default,
    portal: portalModule.default,
  };

  return {
    locale,
    // Fallback to French for any missing keys
    fallbackLocale: DEFAULT_LOCALE,
    messages,
  };
});
