import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import pino from "pino";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogEntry = { time: string; level: LogLevel; event: string; requestId?: string; runId?: string; conversationId?: string; durationMs?: number; error?: string; [key: string]: unknown };

const logFile = path.join(process.cwd(), ".data", "logs", "app.jsonl");
const destination = pino.destination({ dest: logFile, mkdir: true, sync: true });
const baseLogger = pino({ level: process.env.LOG_LEVEL || "info", timestamp: pino.stdTimeFunctions.isoTime }, destination);
function emit(level: LogLevel, event: string, fields: Record<string, unknown> = {}) { baseLogger[level](fields, event); }
export const logger = {
  debug: (event: string, fields?: Record<string, unknown>) => emit("debug", event, fields),
  info: (event: string, fields?: Record<string, unknown>) => emit("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => emit("error", event, fields),
};
export function requestId() { return `req_${randomUUID()}`; }
export async function listLogs(limit = 200): Promise<LogEntry[]> {
  try { const content = await fs.readFile(logFile, "utf8"); return content.trim().split("\n").filter(Boolean).slice(-limit).reverse().flatMap(line => { try { const item = JSON.parse(line) as LogEntry & { timeStamp?: string }; return [{ ...item, time: item.time || item.timeStamp || "" }]; } catch { return []; } }); } catch { return []; }
}
