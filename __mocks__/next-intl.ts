/**
 * Mock for next-intl client-side exports
 */

export const useTranslations = jest.fn((namespace?: string) => {
  return jest.fn((key: string) => key);
});

export const useFormatter = jest.fn(() => ({
  dateTime: jest.fn((date: Date) => date.toISOString()),
  number: jest.fn((value: number) => value.toString()),
  relativeTime: jest.fn((date: Date) => 'relative time'),
}));

export const useLocale = jest.fn(() => 'fr');

export const useMessages = jest.fn(() => ({}));

export const useNow = jest.fn(() => new Date());

export const useTimeZone = jest.fn(() => 'Europe/Paris');

export const NextIntlClientProvider = jest.fn(({ children }: any) => children);
