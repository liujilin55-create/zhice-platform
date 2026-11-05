import { NextResponse } from "next/server";
import { hasAdminCookie } from "@/lib/admin-auth";

export async function GET(request: Request) {
  return NextResponse.json({ authenticated: hasAdminCookie(request) });
}
