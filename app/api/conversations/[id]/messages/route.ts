import { randomUUID } from "crypto";
import { getConversation, listMessages, appendMessage, createRun, updateRun, updateConversation } from "@/lib/storage";
import { streamModel } from "@/lib/model";
import { Message } from "@/lib/types";
const active = new Map<string, AbortController>();
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id; if (!await getConversation(id)) return new Response("Not found", { status: 404 });
  const { content } = await request.json(); if (!content?.trim()) return new Response("内容不能为空", { status: 400 });
  const user: Message = { id: randomUUID(), conversationId: id, role: "user", content: content.trim(), createdAt: new Date().toISOString(), status: "complete" }; await appendMessage(id, user); const run = await createRun(id); const controller = new AbortController(); active.set(id, controller); await updateRun(run.id, { status: "running" });
  const encoder = new TextEncoder(); let assistantText = ""; const stream = new ReadableStream({ start: async (sink) => { const send = (event: string, data: unknown) => sink.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); try { send("run_started", { runId: run.id }); await streamModel(await listMessages(id), token => { assistantText += token; send("token", { token }); }, controller.signal); const assistant: Message = { id: randomUUID(), conversationId: id, role: "assistant", content: assistantText, createdAt: new Date().toISOString(), status: "complete" }; await appendMessage(id, assistant); await updateRun(run.id, { status: "completed" }); await updateConversation(id, { title: (await listMessages(id))[0]?.content.slice(0, 30) || "新会话" }); send("run_completed", { runId: run.id, message: assistant }); } catch (error) { const cancelled = controller.signal.aborted; await updateRun(run.id, { status: cancelled ? "cancelled" : "failed", error: cancelled ? undefined : String(error) }); send(cancelled ? "run_completed" : "run_failed", { runId: run.id, error: cancelled ? undefined : String(error) }); } finally { active.delete(id); sink.close(); } } });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) { const c = active.get((await params).id); if (c) c.abort(); return new Response(null, { status: 204 }); }
