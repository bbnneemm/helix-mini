import { NextResponse } from "next/server";
import { listLogs } from "@/lib/logger";

export async function GET(request: Request) {
  const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit") || 200), 1), 1000);
  return NextResponse.json(await listLogs(limit));
}
