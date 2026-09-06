import { NextResponse } from "next/server";
import { createConversation, listConversations } from "@/lib/storage";
import { logger, requestId } from "@/lib/logger";
export async function GET() { const id = requestId(); const conversations = await listConversations(); await logger.info("api.completed", { requestId: id, method: "GET", path: "/api/conversations", status: 200, response: { count: conversations.length } }); return NextResponse.json(conversations); }
export async function POST() { const id = requestId(); const conversation = await createConversation(); await logger.info("api.completed", { requestId: id, method: "POST", path: "/api/conversations", status: 200, response: conversation, conversationId: conversation.id }); return NextResponse.json(conversation); }
