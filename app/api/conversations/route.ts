import { NextResponse } from "next/server";
import { createConversation, listConversations } from "@/lib/storage";
import { logger, requestId } from "@/lib/logger";
export async function GET() { return NextResponse.json(await listConversations()); }
export async function POST() { const id = requestId(); const conversation = await createConversation(); await logger.info("conversation.created", { requestId: id, conversationId: conversation.id }); return NextResponse.json(conversation); }
