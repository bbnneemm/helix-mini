import { NextResponse } from "next/server";
import { listLogs } from "@/lib/logger";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const page = Math.max(Number(query.get("page") || 1), 1);
  const pageSize = Math.min(Math.max(Number(query.get("pageSize") || 20), 1), 100);
  const all = await listLogs(10000);
  const total = all.length;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  return NextResponse.json({ items: all.slice(start, start + pageSize), total, page: safePage, pageSize, totalPages });
}
