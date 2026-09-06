import { getModelConfig } from "./model-config";
import { Message, ModelOutputEvent } from "./types";

type StreamCallbacks = {
  onToken: (token: string) => void;
  onThinking?: (token: string) => void;
  onEvent?: (event: ModelOutputEvent) => void;
};
type Slot = { type: "text" | "thinking"; content: string; ended: boolean };

function emit(callbacks: StreamCallbacks, event: ModelOutputEvent) { callbacks.onEvent?.(event); }
function ensureSlot(slots: Map<number, Slot>, index: number, type: Slot["type"], callbacks: StreamCallbacks) {
  const existing = slots.get(index);
  if (existing?.type === type) return existing;
  const slot = { type, content: "", ended: false } satisfies Slot;
  slots.set(index, slot);
  emit(callbacks, { type: type === "text" ? "text_start" : "thinking_start", outputIndex: index });
  return slot;
}
function append(callbacks: StreamCallbacks, slot: Slot, index: number, value: string) {
  if (!value) return;
  slot.content += value;
  if (slot.type === "text") { callbacks.onToken(value); emit(callbacks, { type: "text_delta", outputIndex: index, delta: value }); }
  else { callbacks.onThinking?.(value); emit(callbacks, { type: "thinking_delta", outputIndex: index, delta: value }); }
}
function finish(callbacks: StreamCallbacks, slot: Slot, index: number, content?: string) {
  if (slot.ended) return;
  if (content !== undefined) slot.content = content;
  slot.ended = true;
  emit(callbacks, { type: slot.type === "text" ? "text_end" : "thinking_end", outputIndex: index, content: slot.content });
}
function itemText(item: unknown): string {
  if (!item || typeof item !== "object") return "";
  const value = item as { summary?: Array<{ text?: string }>; content?: Array<{ text?: string; refusal?: string }> };
  return value.summary?.map(part => part.text || "").join("\n\n") || value.content?.map(part => part.text || part.refusal || "").join("") || "";
}
function eventError(data: Record<string, unknown>): string {
  const response = data.response as { error?: { message?: string } | string; incomplete_details?: { reason?: string } } | undefined;
  if (typeof response?.error === "string") return response.error;
  if (response?.error?.message) return response.error.message;
  if (response?.incomplete_details?.reason) return `响应未完成：${response.incomplete_details.reason}`;
  return `模型响应状态：${String(data.type || "failed")}`;
}

function handleResponseEvent(data: Record<string, unknown>, callbacks: StreamCallbacks, slots: Map<number, Slot>, responseId?: string) {
  const type = String(data.type || "");
  const index = typeof data.output_index === "number" ? data.output_index : 0;
  if (type === "response.created") { const id = (data.response as { id?: string } | undefined)?.id; emit(callbacks, { type: "start", responseId: id }); return id; }
  if (type === "response.output_item.added") {
    const item = data.item as { type?: string } | undefined;
    if (item?.type === "reasoning") ensureSlot(slots, index, "thinking", callbacks);
    else if (item?.type === "message") ensureSlot(slots, index, "text", callbacks);
    return responseId;
  }
  if (type === "response.reasoning_summary_text.delta" || type === "response.reasoning_text.delta") { append(callbacks, ensureSlot(slots, index, "thinking", callbacks), index, typeof data.delta === "string" ? data.delta : ""); return responseId; }
  if (type === "response.reasoning_summary_part.done") { const slot = slots.get(index); if (slot?.type === "thinking") append(callbacks, slot, index, "\n\n"); return responseId; }
  if (type === "response.output_text.delta" || type === "response.refusal.delta") { append(callbacks, ensureSlot(slots, index, "text", callbacks), index, typeof data.delta === "string" ? data.delta : ""); return responseId; }
  if (type === "response.output_item.done") {
    const item = data.item as { type?: string } | undefined;
    if (item?.type === "reasoning") { const text = itemText(item); finish(callbacks, ensureSlot(slots, index, "thinking", callbacks), index, text || undefined); }
    if (item?.type === "message") { const text = itemText(item); finish(callbacks, ensureSlot(slots, index, "text", callbacks), index, text || undefined); }
    return responseId;
  }
  if (type === "response.failed") throw new Error(eventError(data));
  if (type === "response.incomplete") {
    const reason = (data.response as { incomplete_details?: { reason?: string } } | undefined)?.incomplete_details?.reason;
    if (reason !== "max_output_tokens") throw new Error(eventError(data));
    for (const [slotIndex, slot] of slots) finish(callbacks, slot, slotIndex);
    emit(callbacks, { type: "done", reason: "length", responseId }); return responseId;
  }
  if (type === "response.completed") {
    const response = data.response as { id?: string; output?: unknown[] } | undefined;
    const finalId = response?.id || responseId;
    for (const [outputIndex, item] of (response?.output || []).entries()) {
      const value = item as { type?: string };
      if (value.type === "reasoning") finish(callbacks, ensureSlot(slots, outputIndex, "thinking", callbacks), outputIndex, itemText(value) || undefined);
      if (value.type === "message") finish(callbacks, ensureSlot(slots, outputIndex, "text", callbacks), outputIndex, itemText(value) || undefined);
    }
    for (const [slotIndex, slot] of slots) finish(callbacks, slot, slotIndex);
    emit(callbacks, { type: "done", reason: "stop", responseId: finalId }); return finalId;
  }
  return responseId;
}

async function streamResponses(base: string, key: string, model: string, messages: Message[], signal: AbortSignal, callbacks: StreamCallbacks) {
  const response = await fetch(`${base.replace(/\/$/, "")}/responses`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, stream: true, input: messages.map(m => ({ role: m.role, content: m.content })), reasoning: { effort: "high", summary: "auto" } }), signal });
  if (!response.ok || !response.body) { if ([400, 404, 405, 422].includes(response.status)) return false; throw new Error(`模型请求失败（${response.status}）`); }
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let responseId: string | undefined; let terminal = false; const slots = new Map<number, Slot>();
  while (true) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const chunks = buffer.split(/\r?\n\r?\n/); buffer = chunks.pop() || ""; for (const chunk of chunks) { const line = chunk.split(/\r?\n/).find(item => item.startsWith("data:")); if (!line) continue; const raw = line.slice(5).trim(); if (!raw || raw === "[DONE]") continue; const parsed = JSON.parse(raw) as Record<string, unknown>; const eventType = String(parsed.type || ""); if (eventType === "response.completed" || eventType === "response.incomplete") terminal = true; responseId = handleResponseEvent(parsed, callbacks, slots, responseId); } }
  if (!terminal) throw new Error("模型流在终止事件前结束");
  return true;
}

async function streamChatCompletions(base: string, key: string, model: string, messages: Message[], signal: AbortSignal, callbacks: StreamCallbacks) {
  const response = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, stream: true, messages: messages.map(m => ({ role: m.role, content: m.content })) }), signal });
  if (!response.ok || !response.body) throw new Error(`模型请求失败（${response.status}）`);
  const slot: Slot = { type: "text", content: "", ended: false }; let thinkingStarted = false; let thinkingContent = ""; emit(callbacks, { type: "start" }); emit(callbacks, { type: "text_start", outputIndex: 0 });
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
  while (true) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() || ""; for (const line of lines) { if (!line.startsWith("data:")) continue; const raw = line.slice(5).trim(); if (!raw || raw === "[DONE]") continue; const deltaValue = (JSON.parse(raw) as { choices?: Array<{ delta?: { content?: string; reasoning_content?: string; reasoning?: string; thinking?: string } }> }).choices?.[0]?.delta || {}; const thinking = deltaValue.reasoning_content || deltaValue.reasoning || deltaValue.thinking; if (thinking) { if (!thinkingStarted) { thinkingStarted = true; emit(callbacks, { type: "thinking_start", outputIndex: 0 }); } thinkingContent += thinking; callbacks.onThinking?.(thinking); emit(callbacks, { type: "thinking_delta", outputIndex: 0, delta: thinking }); } if (deltaValue.content) append(callbacks, slot, 0, deltaValue.content); } }
  if (thinkingStarted) emit(callbacks, { type: "thinking_end", outputIndex: 0, content: thinkingContent });
  finish(callbacks, slot, 0); emit(callbacks, { type: "done", reason: "stop" });
}

export async function streamModel(messages: Message[], onToken: (token: string) => void, signal: AbortSignal, onThinking?: (token: string) => void, onEvent?: (event: ModelOutputEvent) => void) {
  const saved = await getModelConfig(); const base = saved.baseUrl || process.env.MODEL_BASE_URL; const key = saved.apiKey || process.env.MODEL_API_KEY; const model = saved.model || process.env.MODEL_NAME || "gpt-4o-mini"; const callbacks = { onToken, onThinking, onEvent };
  if (!base || !key) { const text = `这是 helix-mini 的 Mock 回复。\n\n我收到你的消息：\n\n> ${messages.at(-1)?.content || ""}\n\n配置模型 API Key 后即可切换真实模型。`; emit(callbacks, { type: "start" }); emit(callbacks, { type: "text_start", outputIndex: 0 }); for (const part of text.match(/[\s\S]{1,8}/g) || []) { if (signal.aborted) throw new Error("cancelled"); append(callbacks, { type: "text", content: "", ended: false }, 0, part); await new Promise(resolve => setTimeout(resolve, 25)); } emit(callbacks, { type: "text_end", outputIndex: 0, content: text }); emit(callbacks, { type: "done", reason: "stop" }); return; }
  if (!await streamResponses(base, key, model, messages, signal, callbacks)) await streamChatCompletions(base, key, model, messages, signal, callbacks);
}
