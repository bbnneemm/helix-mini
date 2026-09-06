import { NextResponse } from "next/server";
import { deleteConversation, getConversation, listMessages } from "@/lib/storage";
import { logger, requestId } from "@/lib/logger";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const conversation = await getConversation(id); if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 }); return NextResponse.json({ conversation, messages: await listMessages(id) }); }
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) { const id = (await params).id; await deleteConversation(id); await logger.info("conversation.deleted", { requestId: requestId(), conversationId: id }); return new NextResponse(null, { status: 204 }); }
