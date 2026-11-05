import { getCompetitionDownload } from "@/modules/competition-recommendation/downloads";

const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;

function contentDisposition(fileName: string) {
  const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const download = getCompetitionDownload(id);
  if (!download) return Response.json({ ok: false, error: "暂未配置该比赛的官方要求文件。" }, { status: 404 });

  try {
    const upstream = await fetch(download.url, {
      headers: {
        Accept: "application/pdf, application/zip, text/html, */*",
        Referer: new URL(download.url).origin + "/",
        "User-Agent": "Mozilla/5.0 (compatible; ZhicePlatform/1.0)",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!upstream.ok) return Response.json({ ok: false, error: `赛事要求文件暂时无法获取（${upstream.status}）。` }, { status: 502 });

    const contentLength = Number(upstream.headers.get("content-length") || 0);
    if (contentLength > MAX_DOWNLOAD_BYTES) return Response.json({ ok: false, error: "赛事要求文件超过 25 MB，暂不支持直接下载。" }, { status: 413 });
    const body = await upstream.arrayBuffer();
    if (body.byteLength > MAX_DOWNLOAD_BYTES) return Response.json({ ok: false, error: "赛事要求文件超过 25 MB，暂不支持直接下载。" }, { status: 413 });

    const contentType = upstream.headers.get("content-type")?.split(";")[0] || "application/octet-stream";
    return new Response(body, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": contentDisposition(download.fileName),
        "Content-Length": String(body.byteLength),
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ ok: false, error: "赛事要求文件下载失败，请稍后重试或访问官网。" }, { status: 502 });
  }
}
