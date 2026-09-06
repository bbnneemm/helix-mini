export type Role = "user" | "assistant";
export type RunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type Conversation = { id: string; title: string; createdAt: string; updatedAt: string };
export type Message = { id: string; conversationId: string; role: Role; content: string; thinking?: string; createdAt: string; status?: "complete" | "streaming" | "error" };
export type Run = { id: string; conversationId: string; status: RunStatus; createdAt: string; updatedAt: string; error?: string };

/** Provider-neutral stream events, modeled after Pi's AssistantMessageEvent. */
export type ModelOutputEvent =
  | { type: "start"; responseId?: string }
  | { type: "text_start"; outputIndex: number }
  | { type: "text_delta"; outputIndex: number; delta: string }
  | { type: "text_end"; outputIndex: number; content: string }
  | { type: "thinking_start"; outputIndex: number }
  | { type: "thinking_delta"; outputIndex: number; delta: string }
  | { type: "thinking_end"; outputIndex: number; content: string }
  | { type: "done"; reason: "stop" | "length" | "error"; responseId?: string }
  | { type: "error"; reason: "error" | "aborted"; message: string };
