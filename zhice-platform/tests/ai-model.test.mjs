import assert from "node:assert/strict";
import test from "node:test";
import { generateObject, generateText, streamText } from "ai";
import { z } from "zod";
import { createAiModel } from "../src/lib/ai-model.ts";

const config = { apiKey: "test-key", baseUrl: "https://model.example/v1", model: "test-model" };
const restriction = () => Response.json({ error: { message: "invalid temperature: only 1 is allowed for this model", type: "invalid_request_error" } }, { status: 400 });
const completion = (content = "连接测试成功。") => Response.json({
  id: "chatcmpl-test", object: "chat.completion", created: 1, model: "test-model",
  choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
  usage: { prompt_tokens: 4, completion_tokens: 3, total_tokens: 7 },
});

test("all domestic presets call Chat Completions and preserve a supported temperature", async () => {
  for (const baseUrl of ["https://api.deepseek.com", "https://ark.cn-beijing.volces.com/api/v3", "https://dashscope.aliyuncs.com/compatible-mode/v1"]) {
    let calls = 0;
    const model = createAiModel({ ...config, baseUrl }, { fetch: async (url, init) => {
      calls++;
      assert.equal(String(url), `${baseUrl}/chat/completions`);
      assert.equal(JSON.parse(init.body).temperature, 0);
      return completion();
    } });
    const result = await generateText({ model, prompt: "test", temperature: 0, maxRetries: 0 });
    assert.equal(result.text, "连接测试成功。");
    assert.equal(calls, 1);
  }
});

test("the reported temperature rejection retries once with 1 and preserves request data", async () => {
  const requests = [];
  const adjustments = [];
  const model = createAiModel(config, {
    onTemperatureAdjustment: (value) => adjustments.push(value),
    fetch: async (_url, init) => {
      requests.push(JSON.parse(init.body));
      return requests.length === 1 ? restriction() : completion();
    },
  });
  const result = await generateText({ model, system: "Keep this prompt", prompt: "Keep this question", temperature: 0.3, maxOutputTokens: 100, maxRetries: 0 });
  assert.equal(result.text, "连接测试成功。");
  assert.equal(requests.length, 2);
  assert.equal(requests[0].temperature, 0.3);
  assert.equal(requests[1].temperature, 1);
  assert.deepEqual(requests[1], { ...requests[0], temperature: 1 });
  assert.deepEqual(adjustments, [1]);

  await generateText({ model, prompt: "Next Agent step", temperature: 0.3, maxRetries: 0 });
  assert.equal(requests.length, 3);
  assert.equal(requests[2].temperature, 1);
});

test("structured output recovers from a fixed temperature restriction", async () => {
  const temperatures = [];
  const model = createAiModel(config, { fetch: async (_url, init) => {
    temperatures.push(JSON.parse(init.body).temperature);
    return temperatures.length === 1 ? restriction() : completion('{"title":"竞赛计划"}');
  } });
  const result = await generateObject({ model, schema: z.object({ title: z.string() }), prompt: "test", temperature: 0.3, maxRetries: 0 });
  assert.deepEqual(result.object, { title: "竞赛计划" });
  assert.deepEqual(temperatures, [0.3, 1]);
});

test("streaming recovers before any output is sent and keeps the stream flag", async () => {
  const requests = [];
  const model = createAiModel(config, { fetch: async (_url, init) => {
    const body = JSON.parse(init.body);
    requests.push(body);
    if (requests.length === 1) return restriction();
    const chunk = { id: "chatcmpl-stream", object: "chat.completion.chunk", created: 1, model: "test-model", choices: [{ index: 0, delta: { role: "assistant", content: "流式连接成功" }, finish_reason: "stop" }] };
    return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`, { headers: { "content-type": "text/event-stream" } });
  } });
  const result = streamText({ model, prompt: "test", temperature: 0.3, maxRetries: 0 });
  let text = "";
  for await (const chunk of result.textStream) text += chunk;
  assert.equal(text, "流式连接成功");
  assert.equal(requests.length, 2);
  assert.equal(requests[1].stream, true);
  assert.equal(requests[1].temperature, 1);
});

test("does not retry authentication errors, range errors, or unrelated validation errors", async () => {
  for (const [status, message] of [[401, "Invalid API key"], [400, "temperature must be between 0 and 1"], [400, "Only 1 tool is allowed"], [400, "Unknown model"]]) {
    let calls = 0;
    const model = createAiModel(config, { fetch: async () => {
      calls++;
      return Response.json({ error: { message, type: "invalid_request_error" } }, { status });
    } });
    await assert.rejects(() => generateText({ model, prompt: "test", temperature: 0.3, maxRetries: 0 }));
    assert.equal(calls, 1);
  }
});

test("a rejected correction stops after one retry", async () => {
  let calls = 0;
  const model = createAiModel(config, { fetch: async () => { calls++; return restriction(); } });
  await assert.rejects(() => generateText({ model, prompt: "test", temperature: 0.3, maxRetries: 0 }));
  assert.equal(calls, 2);
});

test("already valid fixed temperature is not retried on another validation failure", async () => {
  let calls = 0;
  const model = createAiModel(config, { fetch: async () => { calls++; return restriction(); } });
  await assert.rejects(() => generateText({ model, prompt: "test", temperature: 1, maxRetries: 0 }));
  assert.equal(calls, 1);
});

test("supports an explicit default (1) restriction in a 422 response", async () => {
  const temperatures = [];
  const model = createAiModel(config, { fetch: async (_url, init) => {
    temperatures.push(JSON.parse(init.body).temperature);
    return temperatures.length === 1
      ? Response.json({ error: { message: "Unsupported value for temperature: Only the default (1) value is supported." } }, { status: 422 })
      : completion();
  } });
  const result = await generateText({ model, prompt: "test", temperature: 0.3, maxRetries: 0 });
  assert.equal(result.text, "连接测试成功。");
  assert.deepEqual(temperatures, [0.3, 1]);
});
