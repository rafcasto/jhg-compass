import { NextRequest, NextResponse } from "next/server";
import { validateLink } from "@/lib/server/registration";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ valid: false, reason: "not_found" });
  const result = await validateLink(token).catch(() => ({ valid: false, reason: "not_found" as const }));
  return NextResponse.json(result);
}
