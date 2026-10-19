'use client';

import { NextIntlClientProvider } from 'next-intl';
import { useEffect, type ReactNode } from 'react';
import { setActiveLocale } from '@/i18n/format';

/**
 * NightCRMIntlProvider — wraps the app with next-intl client-side support.
 *
 * Place inside the body of layout.tsx, below the root html element.
 * The `locale` and `messages` are injected via server components above
 * (using getLocale() / getMessages() from next-intl/server).
 */
interface Props {
  children: ReactNode;
  locale: string;
  messages: Record<string, unknown>;
}

export function NightCRMIntlProvider({ children, locale, messages }: Props) {
  // Keep the client-side format store (src/i18n/format.ts) in sync with the
  // active locale — the same value useLocale() returns — so module-level
  // date/number helpers format for the selected locale in browser-only code.
  // Effects never run during SSR and this sync happens only after the provider
  // mounts, so a component that renders on the server must use useLocale()
  // instead of reading the store.
  useEffect(() => {
    setActiveLocale(locale);
  }, [locale]);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

/**
 * Convenience re-exports for components.
 * Import from '@/i18n/client' instead of 'next-intl' directly
 * for centralized locale handling.
 */
export { useTranslations, useFormatter, useLocale } from 'next-intl';
