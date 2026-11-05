import { NextResponse } from "next/server";
import { adminCookieName, checkAdminCredentials, createAdminSession } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { username?: string; password?: string };
  if (!checkAdminCredentials(String(body.username || ""), String(body.password || ""))) {
    return NextResponse.json({ ok: false, error: "账号或密码不正确。" }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: adminCookieName, value: createAdminSession(), httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 7 * 24 * 60 * 60 });
  return response;
}
