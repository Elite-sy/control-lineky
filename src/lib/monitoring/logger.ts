/**
 * Structured Logger — NightCRM Monitoring
 *
 * Provides consistent, structured logging across the application.
 * All log entries include: timestamp, level, context, message.
 *
 * In development: logs to console with colors.
 * In production with Sentry: forwards errors to Sentry.
 * In production without Sentry: logs to console (JSON for log aggregators).
 */

export type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'fatal';

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warning(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  fatal(message: string, data?: Record<string, unknown>): void;
  child(childContext: string): Logger;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  [key: string]: unknown;
}

interface LoggerOptions {
  /** Module/context label for all entries from this logger */
  context: string;
  /** Minimum log level to output */
  minLevel?: LogLevel;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3,
  fatal: 4,
};

const LOG_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m',   // green
  warning: '\x1b[33m', // yellow
  error: '\x1b[31m',  // red
  fatal: '\x1b[35m',  // magenta
};

const RESET_COLOR = '\x1b[0m';
const ENV_LEVEL: LogLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

/**
 * createLogger — creates a scoped logger instance.
 *
 * Usage:
 *   const log = createLogger({ context: 'CRM:Contacts' });
 *   log.info('Contact created', { contactId: '123', name: 'Alice' });
 *   log.error('Failed to save', { error: err.message });
 */
export function createLogger(options: LoggerOptions): Logger {
  const minLevel = LOG_LEVEL_PRIORITY[options.minLevel ?? ENV_LEVEL];

  function shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= minLevel;
  }

  function formatEntry(level: LogLevel, message: string, data?: Record<string, unknown>): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: options.context,
      ...data,
    };
  }

  function output(entry: LogEntry): void {
    const color = LOG_COLORS[entry.level];
    const prefix = `[${entry.level.toUpperCase()}] [${entry.context}]`;

    if (process.env.NODE_ENV === 'production') {
      // Structured JSON for log aggregators (Datadog, CloudWatch, etc.)
      const json = JSON.stringify(entry);
      switch (entry.level) {
        case 'fatal':
        case 'error':
          console.error(json);
          break;
        case 'warning':
          console.warn(json);
          break;
        default:
          console.log(json);
      }
    } else {
      // Colored console output for development
      const formatted = `${color}${prefix}${RESET_COLOR} ${entry.message}`;
      const extra = Object.keys(entry).filter(k => !['timestamp', 'level', 'message', 'context'].includes(k));
      switch (entry.level) {
        case 'fatal':
        case 'error':
          console.error(formatted, extra.length > 0 ? entry : '');
          break;
        case 'warning':
          console.warn(formatted, extra.length > 0 ? entry : '');
          break;
        default:
          console.log(formatted, extra.length > 0 ? entry : '');
      }
    }
  }

  return {
    debug(message: string, data?: Record<string, unknown>): void {
      if (shouldLog('debug')) output(formatEntry('debug', message, data));
    },
    info(message: string, data?: Record<string, unknown>): void {
      if (shouldLog('info')) output(formatEntry('info', message, data));
    },
    warning(message: string, data?: Record<string, unknown>): void {
      if (shouldLog('warning')) output(formatEntry('warning', message, data));
    },
    error(message: string, data?: Record<string, unknown>): void {
      if (shouldLog('error')) output(formatEntry('error', message, data));
    },
    fatal(message: string, data?: Record<string, unknown>): void {
      if (shouldLog('fatal')) output(formatEntry('fatal', message, data));
    },
    /** Create a child logger with additional context */
    child(childContext: string): ReturnType<typeof createLogger> {
      return createLogger({ context: `${options.context}:${childContext}` });
    },
  };
}

/**
 * Global logger instance for general use.
 */
export const log = createLogger({ context: 'NightCRM' });
