const LEVEL_WEIGHT = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 } as const;

export type LogLevel = keyof typeof LEVEL_WEIGHT;

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const REDACT_KEYS = /pass|secret|token|authorization|jwt|hash|cookie/i;

function redact(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    output[key] = REDACT_KEYS.test(key) ? '[redacted]' : value;
  }
  return output;
}

export interface LoggerOptions {
  level?: LogLevel;
  pretty?: boolean;
}

/**
 * Dependency-free structured logger. One JSON object per line so the platform
 * can ship logs straight into any aggregator without a transport dependency.
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const threshold = LEVEL_WEIGHT[options.level ?? 'info'];
  const pretty = options.pretty ?? false;

  function write(level: Exclude<LogLevel, 'silent'>, message: string, meta?: Record<string, unknown>) {
    if (LEVEL_WEIGHT[level] < threshold) return;

    const safeMeta = redact(meta);
    const time = new Date().toISOString();
    const line = pretty
      ? `${time} ${level.toUpperCase().padEnd(5)} ${message}${safeMeta ? ` ${JSON.stringify(safeMeta)}` : ''}`
      : JSON.stringify({ level, time, msg: message, ...safeMeta });

    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }

  return {
    debug: (message, meta) => write('debug', message, meta),
    info: (message, meta) => write('info', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    error: (message, meta) => write('error', message, meta),
  };
}

export function silentLogger(): Logger {
  return createLogger({ level: 'silent' });
}
