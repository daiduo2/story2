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
    const levels: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
    const left = levels[level] === undefined ? 0 : levels[level];
    const right = levels[this.level] === undefined ? 0 : levels[this.level];
    return left >= right;
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

// ─── File Logger ──────────────────────────────────────────────────────────────

import fs from "fs";
import path from "path";

export class FileLogger implements Logger {
  private filePath: string;
  private level: string;

  constructor(filePath: string, level: "debug" | "info" | "warn" | "error" = "info") {
    this.filePath = filePath;
    this.level = level;
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
  }

  private shouldLog(level: string): boolean {
    const levels: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
    const left = levels[level] === undefined ? 0 : levels[level];
    const right = levels[this.level] === undefined ? 0 : levels[this.level];
    return left >= right;
  }

  private log(level: string, msg: string, meta?: LogMeta) {
    if (!this.shouldLog(level)) return;
    const entry = {
      time: new Date().toISOString(),
      level: level.toUpperCase(),
      pid: process.pid,
      msg,
      ...meta,
    };
    const line = JSON.stringify(entry) + "\n";
    fs.appendFileSync(this.filePath, line, "utf-8");
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

// ─── Logger Factory ───────────────────────────────────────────────────────────

export function createStartupLogger(): FileLogger {
  const logDir = "./log";
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const filePath = path.join(logDir, `server_${timestamp}.log`);
  return new FileLogger(filePath, "info");
}

export const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};
