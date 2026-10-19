import { createNavigation } from 'next-intl/navigation';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from './constants';

/**
 * NightCRM i18n navigation utilities.
 *
 * Provides Link, useRouter, usePathname, redirect with locale awareness.
 * All routing in the app should use these instead of next/navigation.
 *
 * Example:
 *   import { Link, useRouter } from '@/i18n/navigation';
 *   <Link href="/contacts">Contacts</Link>
 */
export const { Link, redirect, usePathname, useRouter } = createNavigation({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
});
