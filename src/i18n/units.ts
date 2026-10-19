/**
 * Locale-aware unit formatting: file sizes, durations and hour-of-day labels.
 *
 * Every helper takes the locale explicitly and uses Intl (NumberFormat unit
 * style, DateTimeFormat), so each locale gets its own unit symbols, spacing
 * and decimal separator (fr "1,5 Mo", en "1.5 MB", de "1,5 MB") instead of a
 * count glued to a hardcoded French/English suffix. The helpers are pure
 * (no React hooks, no module-level locale state): client components pass the
 * locale from useLocale(), server code passes the request locale or
 * DEFAULT_LOCALE.
 */

export type IntlUnit = 'byte' | 'kilobyte' | 'megabyte' | 'gigabyte' | 'hour' | 'minute' | 'second' | 'day';

const BYTE_UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;

/** A number followed by its locale's short unit symbol (e.g. "45 min", "42 d", "3 Min."). */
export function formatUnit(value: number, unit: IntlUnit, locale: string, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits,
  }).format(value);
}

/**
 * File size from a numeric byte count in the 1024-based B / kB / MB / GB
 * ladder: whole bytes, one decimal above (fr "500 o", "1,5 Mo"; en "500 byte", "1.5 MB").
 */
export function formatFileSize(bytes: number, locale: string): string {
  let value = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = unitIndex === 0 ? 0 : 1;
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: BYTE_UNITS[unitIndex],
    unitDisplay: 'short',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Call duration from whole seconds: seconds only under a minute, otherwise
 * minutes plus seconds (fr "3 min 20 s", en "3 min 20 sec", de "3 Min. 20 Sek.").
 */
export function formatDuration(totalSeconds: number, locale: string): string {
  const total = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.round(totalSeconds) : 0;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return formatUnit(seconds, 'second', locale);
  return `${formatUnit(minutes, 'minute', locale)} ${formatUnit(seconds, 'second', locale)}`;
}

/**
 * Meeting length from whole minutes: minutes under an hour, otherwise hours
 * plus the remaining minutes when there are any (fr "45 min", "1 h 30 min", "2 h").
 */
export function formatMinutes(totalMinutes: number, locale: string): string {
  const total = Number.isFinite(totalMinutes) && totalMinutes > 0 ? Math.round(totalMinutes) : 0;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return formatUnit(minutes, 'minute', locale);
  if (minutes === 0) return formatUnit(hours, 'hour', locale);
  return `${formatUnit(hours, 'hour', locale)} ${formatUnit(minutes, 'minute', locale)}`;
}

/**
 * Hour-of-day row label for time grids ("8:00" / "14:00" in fr/de/es/nl/it/sv,
 * "8:00 AM" in en). Formatted from a fixed UTC instant in UTC so only the hour
 * matters, never the viewer's or the server's timezone.
 */
export function formatHourOfDay(hour: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(Date.UTC(2000, 0, 1, hour));
}
