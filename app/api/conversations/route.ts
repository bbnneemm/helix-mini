import { NextResponse } from "next/server";
import { createConversation, listConversations } from "@/lib/storage";
export async function GET() { return NextResponse.json(await listConversations()); }
export async function POST() { return NextResponse.json(await createConversation()); }
