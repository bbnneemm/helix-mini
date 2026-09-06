import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogEntry = { time: string; level: LogLevel; event: string; requestId?: string; runId?: string; conversationId?: string; durationMs?: number; error?: string; [key: string]: unknown };

const logsDir = path.join(process.cwd(), ".data", "logs");
const day = () => new Date().toISOString().slice(0, 10);

export async function writeLog(level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
  try {
    await fs.mkdir(logsDir, { recursive: true });
    const entry: LogEntry = { time: new Date().toISOString(), level, event, ...fields };
    await fs.appendFile(path.join(logsDir, `app-${day()}.jsonl`), `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // Logging must never make a user request fail.
  }
}

export const logger = {
  debug: (event: string, fields?: Record<string, unknown>) => writeLog("debug", event, fields),
  info: (event: string, fields?: Record<string, unknown>) => writeLog("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => writeLog("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => writeLog("error", event, fields),
};

export function requestId() { return `req_${randomUUID()}`; }

export async function listLogs(limit = 200): Promise<LogEntry[]> {
  try {
    const files = (await fs.readdir(logsDir)).filter(file => file.endsWith(".jsonl")).sort().reverse();
    const lines: string[] = [];
    for (const file of files) {
      const content = await fs.readFile(path.join(logsDir, file), "utf8");
      lines.push(...content.trim().split("\n").filter(Boolean));
      if (lines.length >= limit) break;
    }
    return lines.slice(-limit).reverse().flatMap(line => { try { return [JSON.parse(line) as LogEntry]; } catch { return []; } });
  } catch { return []; }
}
