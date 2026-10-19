/**
 * Structured Logger Utility — CRM-FACTORY
 *
 * Drop-in replacement for console.error / console.warn that produces
 * structured, filterable log output.
 *
 * - In development: pretty-prints to console (delegated to monitoring/logger).
 * - In production: JSON-formatted for log aggregators; forwards to Sentry when configured.
 * - Includes context (service name, error code, etc.) via the second argument.
 *
 * Usage:
 *   import { logger, getErrorMessage } from '@/lib/logger';
 *
 *   logger.error('Failed to send email', { error: getErrorMessage(err), service: 'email-scheduler' });
 *   logger.warn('Rate limit approaching', { remaining: 5 });
 *   logger.info('User logged in', { userId: '123' });
 *   logger.debug('Cache hit', { key: 'contacts:123' });
 *
 *   // Also works as a direct console.error replacement:
 *   logger.error('Something went wrong', err);
 *   logger.error(err);
 */

import { createLogger } from './monitoring/logger';

const internalLogger = createLogger({ context: 'App' });

/**
 * Safely extract a human-readable message from any thrown value.
 * Works with Error instances, strings, plain objects, and primitives.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error === null) return 'null';
  if (error === undefined) return 'undefined';
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Build a structured context object from the extra arguments passed to a log method.
 * - A single Error → { error: message, stack }
 * - A single plain object → used as-is
 * - Anything else → { args: [...] } with Errors stringified
 */
function createContext(args: unknown[]): Record<string, unknown> | undefined {
  if (args.length === 0) return undefined;

  if (args.length === 1) {
    const arg = args[0];
    if (arg instanceof Error) {
      return { error: getErrorMessage(arg), stack: arg.stack };
    }
    if (typeof arg === 'object' && arg !== null && !Array.isArray(arg)) {
      return arg as Record<string, unknown>;
    }
    return { value: arg };
  }

  return {
    args: args.map((a) => (a instanceof Error ? getErrorMessage(a) : a)),
  };
}

function log(
  level: 'error' | 'warning' | 'info' | 'debug',
  args: unknown[],
): void {
  if (args.length === 0) return;

  const first = args[0];
  const context = createContext(args.slice(1));

  if (typeof first === 'string') {
    internalLogger[level](first, context);
  } else {
    internalLogger[level](getErrorMessage(first), context);
  }
}

export const logger = {
  error(...args: unknown[]): void {
    log('error', args);
  },
  warn(...args: unknown[]): void {
    log('warning', args);
  },
  info(...args: unknown[]): void {
    log('info', args);
  },
  debug(...args: unknown[]): void {
    log('debug', args);
  },
};
