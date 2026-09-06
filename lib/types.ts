export type Role = "user" | "assistant";
export type RunStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type Conversation = { id: string; title: string; createdAt: string; updatedAt: string };
export type Message = { id: string; conversationId: string; role: Role; content: string; thinking?: string; createdAt: string; status?: "complete" | "streaming" | "error" };
export type Run = { id: string; conversationId: string; status: RunStatus; createdAt: string; updatedAt: string; error?: string };
