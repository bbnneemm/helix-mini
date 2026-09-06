import { Message } from "./types";
import { getModelConfig } from "./model-config";

type StreamCallbacks = { onToken: (token: string) => void; onThinking?: (token: string) => void };

function emitReasoningItem(item: unknown, callbacks: StreamCallbacks, state: { emitted: boolean }) {
  if (!item || typeof item !== "object") return;
  const value = item as { type?: string; summary?: Array<{ type?: string; text?: string }> };
  if (value.type !== "reasoning" || !Array.isArray(value.summary) || state.emitted) return;
  for (const part of value.summary) if (part.type === "summary_text" && part.text) { callbacks.onThinking?.(part.text); state.emitted = true; }
}

function handleResponseEvent(data: Record<string, unknown>, callbacks: StreamCallbacks, state: { emitted: boolean }) {
  const type = String(data.type || "");
  if (type === "response.reasoning_summary_text.delta" || type === "response.reasoning_text.delta") { const delta = typeof data.delta === "string" ? data.delta : ""; if (delta) { callbacks.onThinking?.(delta); state.emitted = true; } return; }
  if (type === "response.reasoning_summary_text.done" || type === "response.reasoning_text.done") { if (!state.emitted && typeof data.text === "string" && data.text) { callbacks.onThinking?.(data.text); state.emitted = true; } return; }
  if (type === "response.output_text.delta") { if (typeof data.delta === "string" && data.delta) callbacks.onToken(data.delta); return; }
  if (type === "response.output_item.done") { emitReasoningItem(data.item, callbacks, state); return; }
  if (type === "response.failed" || type === "response.incomplete") { const response = data.response as { error?: { message?: string } | string } | undefined; const error = typeof response?.error === "string" ? response.error : response?.error?.message; throw new Error(error || `模型响应状态：${type}`); }
  if (type === "response.completed") { const response = data.response as { output?: unknown[] } | undefined; for (const item of response?.output || []) emitReasoningItem(item, callbacks, state); }
}

async function streamResponses(base: string, key: string, model: string, messages: Message[], signal: AbortSignal, callbacks: StreamCallbacks) {
  const response = await fetch(`${base.replace(/\/$/, "")}/responses`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, stream: true, input: messages.map(m => ({ role: m.role, content: m.content })), reasoning: { effort: "high", summary: "auto" } }), signal });
  if (!response.ok || !response.body) { if ([400, 404, 405, 422].includes(response.status)) return false; throw new Error(`模型请求失败（${response.status}）`); }
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; const state = { emitted: false };
  while (true) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const events = buffer.split(/\r?\n\r?\n/); buffer = events.pop() || ""; for (const event of events) { const dataLine = event.split(/\r?\n/).find(line => line.startsWith("data: ")); if (!dataLine || dataLine.includes("[DONE]")) continue; try { handleResponseEvent(JSON.parse(dataLine.slice(6)) as Record<string, unknown>, callbacks, state); } catch (error) { if (error instanceof Error && !error.message.startsWith("Unexpected")) throw error; } } }
  return true;
}

async function streamChatCompletions(base: string, key: string, model: string, messages: Message[], signal: AbortSignal, callbacks: StreamCallbacks) {
  const response = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, stream: true, messages: messages.map(m => ({ role: m.role, content: m.content })) }), signal });
  if (!response.ok || !response.body) throw new Error(`模型请求失败（${response.status}）`);
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
  while (true) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() || ""; for (const line of lines) { if (!line.startsWith("data: ") || line.includes("[DONE]")) continue; try { const delta = JSON.parse(line.slice(6)).choices?.[0]?.delta || {}; const thinking = delta.reasoning_content || delta.reasoning || delta.thinking; if (thinking) callbacks.onThinking?.(thinking); if (delta.content) callbacks.onToken(delta.content); } catch {} } }
}

export async function streamModel(messages: Message[], onToken: (token: string) => void, signal: AbortSignal, onThinking?: (token: string) => void) {
  const saved = await getModelConfig(); const base = saved.baseUrl || process.env.MODEL_BASE_URL; const key = saved.apiKey || process.env.MODEL_API_KEY; const model = saved.model || process.env.MODEL_NAME || "gpt-4o-mini"; const callbacks = { onToken, onThinking };
  if (!base || !key) { const text = `这是 helix-mini 的 Mock 回复。\n\n我收到你的消息：\n\n> ${messages.at(-1)?.content || ""}\n\n配置模型 API Key 后即可切换真实模型。`; for (const part of text.match(/[\s\S]{1,8}/g) || []) { if (signal.aborted) throw new Error("cancelled"); onToken(part); await new Promise(r => setTimeout(r, 25)); } return; }
  if (!await streamResponses(base, key, model, messages, signal, callbacks)) await streamChatCompletions(base, key, model, messages, signal, callbacks);
}
