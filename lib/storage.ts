import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { Conversation, Message, Run } from "./types";

const root = path.join(process.cwd(), ".data");
const conversationsFile = path.join(root, "conversations.json");
const messagesDir = path.join(root, "messages");
const runsDir = path.join(root, "runs");

async function ensure() { await fs.mkdir(messagesDir, { recursive: true }); await fs.mkdir(runsDir, { recursive: true }); try { await fs.access(conversationsFile); } catch { await writeJson(conversationsFile, []); } }
async function readJson<T>(file: string, fallback: T): Promise<T> { try { return JSON.parse(await fs.readFile(file, "utf8")) as T; } catch { return fallback; } }
async function writeJson(file: string, value: unknown) { const tmp = `${file}.${process.pid}.tmp`; await fs.writeFile(tmp, JSON.stringify(value, null, 2)); await fs.rename(tmp, file); }
export async function listConversations() { await ensure(); return readJson<Conversation[]>(conversationsFile, []); }
export async function createConversation() { await ensure(); const now = new Date().toISOString(); const c: Conversation = { id: randomUUID(), title: "新会话", createdAt: now, updatedAt: now }; const all = await listConversations(); await writeJson(conversationsFile, [c, ...all]); return c; }
export async function getConversation(id: string) { return (await listConversations()).find(c => c.id === id); }
export async function updateConversation(id: string, patch: Partial<Conversation>) { const all = await listConversations(); const next = all.map(c => c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c); await writeJson(conversationsFile, next); }
export async function deleteConversation(id: string) { const all = await listConversations(); await writeJson(conversationsFile, all.filter(c => c.id !== id)); await Promise.all([fs.rm(path.join(messagesDir, `${id}.json`), { force: true }), ...[]]); }
export async function listMessages(id: string) { await ensure(); return readJson<Message[]>(path.join(messagesDir, `${id}.json`), []); }
export async function appendMessage(id: string, message: Message) { const all = await listMessages(id); await writeJson(path.join(messagesDir, `${id}.json`), [...all, message]); await updateConversation(id, {}); }
export async function createRun(conversationId: string) { await ensure(); const now = new Date().toISOString(); const run: Run = { id: randomUUID(), conversationId, status: "queued", createdAt: now, updatedAt: now }; await writeJson(path.join(runsDir, `${run.id}.json`), run); return run; }
export async function updateRun(id: string, patch: Partial<Run>) { const file = path.join(runsDir, `${id}.json`); const run = await readJson<Run | null>(file, null); if (run) await writeJson(file, { ...run, ...patch, updatedAt: new Date().toISOString() }); }
