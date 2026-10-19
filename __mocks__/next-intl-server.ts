/**
 * Mock for next-intl/server exports
 */

export const getTranslations = jest.fn(async (namespace?: string) => {
  return jest.fn((key: string) => key);
});

export const getFormatter = jest.fn(async () => ({
  dateTime: jest.fn((date: Date) => date.toISOString()),
  number: jest.fn((value: number) => value.toString()),
  relativeTime: jest.fn((date: Date) => 'relative time'),
}));

export const getLocale = jest.fn(async () => 'fr');

export const getMessages = jest.fn(async () => ({}));

export const getNow = jest.fn(async () => new Date());

export const getTimeZone = jest.fn(async () => 'Europe/Paris');

export const getRequestConfig = jest.fn(async () => ({
  locale: 'fr',
  messages: {},
}));

export const setRequestLocale = jest.fn(async (locale: string) => {});
