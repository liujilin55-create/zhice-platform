import type { z } from "zod";

export class ApiError extends Error {
  public status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiRequest<T>(url: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", ...init });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError("网络连接不可用。", 0);
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : "请求失败，请重试。";
    throw new ApiError(message, response.status);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new ApiError("返回数据格式异常，请重试。", response.status);
  return parsed.data;
}

/** Decode incrementally: UTF-8 characters and JSON lines can cross chunks. */
export async function readJsonLines<T>(body: ReadableStream<Uint8Array>, schema: z.ZodType<T>, onEvent: (event: T) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  const parse = (line: string) => {
    if (!line.trim()) return;
    let json: unknown;
    try { json = JSON.parse(line); } catch { throw new ApiError("流式内容不完整，请重试。", 200); }
    const event = schema.safeParse(json);
    if (!event.success) throw new ApiError("流式数据格式异常，请重试。", 200);
    onEvent(event.data);
  };
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      pending += decoder.decode(chunk.value, { stream: true });
      let boundary: number;
      while ((boundary = pending.indexOf("\n")) >= 0) {
        parse(pending.slice(0, boundary));
        pending = pending.slice(boundary + 1);
      }
      if (pending.length > 2_000_000) throw new ApiError("流式内容过大，请重试。", 200);
    }
    parse(pending + decoder.decode());
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function apiEventRequest<T>(url: string, schema: z.ZodType<T>, onEvent: (event: T) => void, init: RequestInit, legacy: (payload: unknown) => T) {
  try {
    const response = await fetch(url, { cache: "no-store", ...init });
    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null);
      const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : "请求失败，请重试。";
      throw new ApiError(message, response.status);
    }
    if (response.headers.get("content-type")?.includes("application/json")) {
      onEvent(legacy(await response.json()));
      return;
    }
    if (!response.body) throw new ApiError("未收到流式内容，请重试。", response.status);
    await readJsonLines(response.body, schema, onEvent);
  } catch (error) {
    if (init.signal?.aborted || error instanceof ApiError) throw error;
    throw new ApiError("连接已中断，已接收内容仍可阅读，请重试。", 0);
  }
}

export async function readServerEvents<T>(body: ReadableStream<Uint8Array>, schema: z.ZodType<T>, onEvent: (event: T) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let data: string[] = [];
  const line = (value: string) => {
    if (!value) {
      if (!data.length) return;
      let raw: unknown;
      try { raw = JSON.parse(data.join("\n")); } catch { throw new ApiError("简报流数据不完整，请重试。", 200); }
      data = [];
      const parsed = schema.safeParse(raw);
      if (!parsed.success) throw new ApiError("简报流格式异常，请重试。", 200);
      onEvent(parsed.data);
    } else if (value.startsWith("data:")) data.push(value.slice(5).replace(/^ /, ""));
  };
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      pending += decoder.decode(chunk.value, { stream: true });
      let boundary: number;
      while ((boundary = pending.indexOf("\n")) >= 0) {
        line(pending.slice(0, boundary).replace(/\r$/, ""));
        pending = pending.slice(boundary + 1);
      }
      if (pending.length + data.join("").length > 1_000_000) throw new ApiError("简报内容过大。", 200);
    }
    pending += decoder.decode();
    if (pending || data.length) throw new ApiError("简报连接提前结束，请重试。", 200);
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function apiSseRequest<T>(url: string, schema: z.ZodType<T>, onEvent: (event: T) => void, init: RequestInit) {
  try {
    const response = await fetch(url, { cache: "no-store", ...init });
    if (!response.ok || !response.body) throw new ApiError("简报服务暂不可用，请重试。", response.status);
    await readServerEvents(response.body, schema, onEvent);
  } catch (error) {
    if (init.signal?.aborted || error instanceof ApiError) throw error;
    throw new ApiError("简报连接已中断，请重试。", 0);
  }
}
