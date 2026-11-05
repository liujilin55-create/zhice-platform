import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { promises as fs, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
  if (specifier === "@/lib/ai-config") return { url: "data:text/javascript,export async function getAiConfig(){return {enabled:false}}", shortCircuit: true };
  if (specifier === "@/modules/ppt-generator/render") return { url: "data:text/javascript,export async function renderPptx(){return new TextEncoder().encode('fixture-ppt')}", shortCircuit: true };
  if (specifier.startsWith("@/")) {
    const target = new URL("../src/" + specifier.slice(2), import.meta.url);
    return { url: existsSync(fileURLToPath(target) + ".ts") ? target.href + ".ts" : target.href + "/index.ts", shortCircuit: true };
  }
  if (specifier.startsWith(".") && !path.extname(specifier)) { try { return nextResolve(specifier + ".ts", context); } catch { /* Standard resolution follows. */ } }
  return nextResolve(specifier, context);
} });

test("PPT history and downloads require the owning project, and invalid paths cannot escape its directory", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "zhice-ppt-project-test-"));
  const previous = process.cwd(); process.chdir(directory);
  try {
    const { GET, POST } = await import("../src/app/api/ppt/route.ts");
    const outline = { title: "测试项目", subtitle: "测试素材", slides: Array.from({ length: 8 }, (_, index) => ({ id: "slide-" + index, title: "标题 " + index, bullets: ["已知事实"], speakerNotes: "测试备注", layout: "content" })) };
    const render = (projectId) => POST(new Request("http://localhost/api/ppt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "render", projectId, outline, template: "zhice-dark", humanConfirmed: true }) }));
    const response = await render("project-a"); assert.equal(response.status, 200);
    const { history } = await response.json(); assert.equal(history.projectId, "project-a");
    assert.match(history.masterArtifactId, /^master-[a-f0-9-]{36}$/);
    assert.equal((await GET(new Request("http://localhost" + history.masterManifestUrl))).status, 200);
    assert.equal((await GET(new Request("http://localhost" + history.masterDesignSpecUrl))).status, 200);
    assert.equal((await GET(new Request("http://localhost" + history.masterNotesUrl))).status, 200);
    assert.equal((await (await GET(new Request("http://localhost/api/ppt?projectId=project-a"))).json()).history.length, 1);
    assert.equal((await (await GET(new Request("http://localhost/api/ppt?projectId=project-b"))).json()).history.length, 0);
    assert.equal((await (await GET(new Request("http://localhost/api/ppt"))).json()).history.length, 0);
    assert.equal((await GET(new Request("http://localhost" + history.downloadUrl))).status, 200);
    assert.equal((await GET(new Request("http://localhost/api/ppt?projectId=project-b&file=" + history.id))).status, 404);
    assert.equal((await render("../escape")).status, 400);
    assert.equal((await GET(new Request("http://localhost/api/ppt?projectId=..%2Fescape&file=" + history.id))).status, 400);
  } finally {
    process.chdir(previous);
    const resolved = path.resolve(directory);
    assert(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith("zhice-ppt-project-test-"));
    await fs.rm(resolved, { recursive: true, force: true });
  }
});
