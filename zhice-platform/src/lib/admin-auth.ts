import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const adminCookieName = "zhice_admin_session";
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;

function secret() {
  return process.env.ADMIN_SESSION_SECRET || "zhice-local-admin-session-change-me";
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function checkAdminCredentials(username: string, password: string) {
  return username === (process.env.ADMIN_USERNAME || "admin") && password === (process.env.ADMIN_PASSWORD || "admin");
}

export function createAdminSession() {
  const payload = `${Date.now()}.${randomBytes(18).toString("hex")}`;
  return `${payload}.${signature(payload)}`;
}

export function isValidAdminSession(token: string | undefined) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [timestamp, nonce, received] = parts;
  if (!timestamp || !nonce || !received || Date.now() - Number(timestamp) > sessionLifetimeMs || Date.now() - Number(timestamp) < 0) return false;
  const expected = signature(`${timestamp}.${nonce}`);
  try {
    return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function hasAdminCookie(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const token = cookieHeader.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${adminCookieName}=`))?.slice(adminCookieName.length + 1);
  return isValidAdminSession(token);
}
