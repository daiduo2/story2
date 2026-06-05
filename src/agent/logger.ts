interface LogMeta {
  [key: string]: unknown;
}

export interface Logger {
  debug(msg: string, meta?: LogMeta): void;
  info(msg: string, meta?: LogMeta): void;
  warn(msg: string, meta?: LogMeta): void;
  error(msg: string, meta?: LogMeta): void;
}

export class ConsoleLogger implements Logger {
  constructor(private level: "debug" | "info" | "warn" | "error" = "info") {}

  private shouldLog(level: string): boolean {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    return levels[level as keyof typeof levels] >= levels[this.level];
  }

  private log(level: string, msg: string, meta?: LogMeta) {
    if (!this.shouldLog(level)) return;
    const entry = {
      time: new Date().toISOString(),
      level,
      msg,
      ...meta,
    };
    console.log(JSON.stringify(entry));
  }

  debug(msg: string, meta?: LogMeta) {
    this.log("debug", msg, meta);
  }
  info(msg: string, meta?: LogMeta) {
    this.log("info", msg, meta);
  }
  warn(msg: string, meta?: LogMeta) {
    this.log("warn", msg, meta);
  }
  error(msg: string, meta?: LogMeta) {
    this.log("error", msg, meta);
  }
}

export const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};
