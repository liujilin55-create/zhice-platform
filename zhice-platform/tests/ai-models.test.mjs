import assert from "node:assert/strict";
import test from "node:test";
import { AiModelsError, listAiModels } from "../src/lib/ai-models.ts";
import { providerPresets } from "../src/lib/ai-providers.ts";

test("Moonshot preset uses the documented endpoint and API model ID", () => {
  assert.equal(providerPresets.moonshot.baseUrl, "https://api.moonshot.cn/v1");
  assert.equal(providerPresets.moonshot.model, "kimi-k3.1-pro");
});

test("model discovery authenticates on /models and returns only deduplicated IDs", async () => {
  const models = await listAiModels({ apiKey: "test-secret", baseUrl: "https://api.moonshot.cn/v1/" }, async (url, init) => {
    assert.equal(String(url), "https://api.moonshot.cn/v1/models");
    assert.equal(init.headers.Authorization, "Bearer test-secret");
    assert.equal(init.cache, "no-store");
    return Response.json({ object: "list", data: [
      { id: "kimi-k3.1-pro", owned_by: "moonshot", internal: "not-for-client" },
      { id: "kimi-k3.1-pro", owned_by: "moonshot" },
      { id: "other-model" }, {}, null, { id: "" }, { id: 12 },
    ] });
  });
  assert.deepEqual(models, [{ id: "kimi-k3.1-pro", ownedBy: "moonshot" }, { id: "other-model", ownedBy: "" }]);
});

test("missing credentials and invalid Base URL never contact an upstream", async () => {
  const unreachableFetch = async () => { assert.fail("must not send a request"); };
  for (const config of [{ apiKey: "", baseUrl: "https://api.moonshot.cn/v1" }, { apiKey: "test", baseUrl: "not a url" }, { apiKey: "test", baseUrl: "file:///tmp" }]) {
    await assert.rejects(() => listAiModels(config, unreachableFetch), (error) => error instanceof AiModelsError && error.status === 400);
  }
});

test("auth and unsupported list endpoints return actionable errors without upstream secrets", async () => {
  for (const status of [401, 403, 404, 405, 429, 500]) {
    await assert.rejects(() => listAiModels({ apiKey: "test-secret", baseUrl: "https://model.example/v1" }, async () => Response.json({ error: { message: "test-secret upstream debug" } }, { status })), (error) => {
      assert.equal(error instanceof AiModelsError, true);
      assert.equal(error.message.includes("test-secret"), false);
      if ([401, 403].includes(status)) assert.match(error.message, /API Key/);
      if ([404, 405].includes(status)) assert.match(error.message, /控制台/);
      return true;
    });
  }
});

test("malformed JSON and incompatible response shapes cannot masquerade as model lists", async () => {
  for (const response of [new Response("<!doctype html>"), Response.json({ models: ["not-the-contract"] }), Response.json(null)]) {
    await assert.rejects(() => listAiModels({ apiKey: "test", baseUrl: "https://model.example/v1" }, async () => response), (error) => error instanceof AiModelsError && error.status === 502);
  }
});

test("an empty platform model list remains empty", async () => {
  const models = await listAiModels({ apiKey: "test", baseUrl: "https://model.example/v1" }, async () => Response.json({ data: [] }));
  assert.deepEqual(models, []);
});
