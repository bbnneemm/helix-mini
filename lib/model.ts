import { Message } from "./types";
import { getModelConfig } from "./model-config";
export async function streamModel(messages: Message[], onToken: (token: string) => void, signal: AbortSignal, onThinking?: (token: string) => void) {
  const saved = await getModelConfig(); const base = saved.baseUrl || process.env.MODEL_BASE_URL; const key = saved.apiKey || process.env.MODEL_API_KEY; const model = saved.model || process.env.MODEL_NAME || "gpt-4o-mini";
  if (!base || !key) { const text = `这是 helix-mini 的 Mock 回复。\n\n我收到你的消息：\n\n> ${messages.at(-1)?.content || ""}\n\n配置 MODEL_API_KEY 后即可切换真实模型。`; for (const part of text.match(/[\s\S]{1,8}/g) || []) { if (signal.aborted) throw new Error("cancelled"); onToken(part); await new Promise(r => setTimeout(r, 25)); } return; }
  const response = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, stream: true, messages: messages.map(m => ({ role: m.role, content: m.content })) }), signal });
  if (!response.ok || !response.body) throw new Error(`模型请求失败（${response.status}）`);
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
  while (true) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() || ""; for (const line of lines) { if (!line.startsWith("data: ") || line.includes("[DONE]")) continue; try { const delta = JSON.parse(line.slice(6)).choices?.[0]?.delta || {}; const thinking = delta.reasoning_content || delta.reasoning || delta.thinking; if (thinking && onThinking) onThinking(thinking); const token = delta.content; if (token) onToken(token); } catch {} } }
}
