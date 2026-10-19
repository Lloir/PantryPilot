// Checks the AI layer against fake Ollama / OpenAI-compatible servers (no real model needed).
import assert from 'node:assert/strict';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { AiError, createLlm, friendlyAiError, loadLlmConfig, parseJsonLoose, toGeminiSchema } from '../server-lib/llm';

// ---- config -----------------------------------------------------------------
assert.deepEqual(loadLlmConfig({}).order, []);
assert.deepEqual(loadLlmConfig({ GEMINI_API_KEY: 'k' }).order, ['gemini']);
assert.deepEqual(loadLlmConfig({ OLLAMA_MODEL: 'qwen2.5vl' }).order, ['ollama']);
// local first by default, cloud as backup
assert.deepEqual(loadLlmConfig({ OLLAMA_MODEL: 'm', GEMINI_API_KEY: 'k' }).order, ['ollama', 'gemini']);
// explicit order wins, unconfigured providers are dropped, aliases work
assert.deepEqual(loadLlmConfig({ AI_PROVIDER: 'gemini, ollama', OLLAMA_MODEL: 'm', GEMINI_API_KEY: 'k' }).order, ['gemini', 'ollama']);
assert.deepEqual(loadLlmConfig({ AI_PROVIDER: 'ollama', GEMINI_API_KEY: 'k' }).order, []);
assert.deepEqual(loadLlmConfig({ AI_PROVIDER: 'lmstudio', LLM_BASE_URL: 'http://x/v1/', LLM_MODEL: 'm' }).order, ['openai']);
assert.equal(loadLlmConfig({ LLM_BASE_URL: 'http://x/v1/', LLM_MODEL: 'm' }).openai.baseUrl, 'http://x/v1');
const cfg = loadLlmConfig({ OLLAMA_MODEL: 'text', OLLAMA_URL: 'http://h:11434/' });
assert.equal(cfg.ollama.url, 'http://h:11434');
assert.equal(cfg.ollama.visionModel, 'text');
assert.equal(loadLlmConfig({ OLLAMA_MODEL: 'text', OLLAMA_VISION_MODEL: 'eyes' }).ollama.visionModel, 'eyes');
assert.equal(loadLlmConfig({ OLLAMA_MODEL: 'm', OLLAMA_NUM_CTX: 'abc' }).ollama.numCtx, 8192);

// ---- parsing ------------------------------------------------------------------
assert.deepEqual(parseJsonLoose('{"a":1}'), { a: 1 });
assert.deepEqual(parseJsonLoose('```json\n{"a":1}\n```'), { a: 1 });
assert.deepEqual(parseJsonLoose('Sure! Here you go: {"a":[1,2]} Hope that helps'), { a: [1, 2] });
assert.deepEqual(parseJsonLoose('[1,2]'), [1, 2]);
assert.throws(() => parseJsonLoose('no json here'), (e: any) => e instanceof AiError && e.code === 'bad_output');
assert.throws(() => parseJsonLoose('{"a":'), (e: any) => e instanceof AiError && e.code === 'bad_output');
assert.deepEqual(
  toGeminiSchema({ type: 'object', properties: { a: { type: 'array', items: { type: 'integer' } } }, required: ['a'] }),
  { type: 'OBJECT', properties: { a: { type: 'ARRAY', items: { type: 'INTEGER' } } }, required: ['a'] },
);
assert.ok(!/192\.|http/.test(friendlyAiError(new AiError('unreachable', 'Could not reach http://192.168.1.5:11434'), 'read this receipt')));

// ---- fake servers ------------------------------------------------------------------
type Handler = (req: http.IncomingMessage, body: any, res: http.ServerResponse) => void;
async function fake(handler: Handler) {
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', c => (raw += c));
    req.on('end', () => {
      let body: any = null;
      try { body = raw ? JSON.parse(raw) : null; } catch { /* ignore */ }
      handler(req, body, res);
    });
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { url, close: () => new Promise<void>(r => server.close(() => r())) };
}
const json = (res: http.ServerResponse, status: number, data: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};
const receiptSchema = { type: 'object' as const, properties: { store: { type: 'string' as const } }, required: ['store'] };
const image = { mimeType: 'image/jpeg', base64: 'AAAA' };

// ---- Ollama -------------------------------------------------------------------------
{
  const seen: any[] = [];
  const ollama = await fake((req, body, res) => {
    seen.push({ url: req.url, auth: req.headers.authorization, body });
    json(res, 200, { message: { content: '```json\n{"store":"Tesco"}\n```' } });
  });
  const llm = createLlm(loadLlmConfig({ OLLAMA_URL: ollama.url, OLLAMA_MODEL: 'text-model', OLLAMA_VISION_MODEL: 'vision-model', OLLAMA_API_KEY: 'secret' }));
  const out = await llm.generateJson({ prompt: 'read it', schema: receiptSchema, image, maxTokens: 123 });
  assert.deepEqual(out, { store: 'Tesco' });
  assert.equal(seen[0].url, '/api/chat');
  assert.equal(seen[0].auth, 'Bearer secret');
  assert.equal(seen[0].body.model, 'vision-model', 'images use the vision model');
  assert.deepEqual(seen[0].body.messages[0].images, ['AAAA']);
  assert.equal(seen[0].body.stream, false);
  assert.equal(seen[0].body.options.num_ctx, 8192);
  assert.equal(seen[0].body.options.num_predict, 123);
  assert.deepEqual(seen[0].body.format, receiptSchema);

  await llm.generateJson({ prompt: 'text only', schema: receiptSchema });
  assert.equal(seen[1].body.model, 'text-model', 'text-only calls use the text model');
  assert.equal(seen[1].body.messages[0].images, undefined);
  await ollama.close();
}

// arrays are wrapped for the server and unwrapped for the caller
{
  let sent: any;
  const ollama = await fake((_req, body, res) => {
    sent = body;
    json(res, 200, { message: { content: '{"items":[{"n":1},{"n":2}]}' } });
  });
  const llm = createLlm(loadLlmConfig({ OLLAMA_URL: ollama.url, OLLAMA_MODEL: 'm' }));
  const list = await llm.generateJson({ prompt: 'list', schema: { type: 'array', items: { type: 'object', properties: { n: { type: 'integer' } } } } });
  assert.deepEqual(list, [{ n: 1 }, { n: 2 }]);
  assert.equal(sent.format.type, 'object');
  await ollama.close();
}

// garbage once, then fine: retried; garbage always: bad_output
{
  let calls = 0;
  const ollama = await fake((_req, _body, res) => {
    calls++;
    json(res, 200, { message: { content: calls === 1 ? 'I cannot do that' : '{"store":"Aldi"}' } });
  });
  const llm = createLlm(loadLlmConfig({ OLLAMA_URL: ollama.url, OLLAMA_MODEL: 'm' }));
  assert.deepEqual(await llm.generateJson({ prompt: 'x', schema: receiptSchema }), { store: 'Aldi' });
  assert.equal(calls, 2);
  await ollama.close();

  const bad = await fake((_req, _body, res) => json(res, 200, { message: { content: 'nope' } }));
  const llm2 = createLlm(loadLlmConfig({ OLLAMA_URL: bad.url, OLLAMA_MODEL: 'm' }));
  await assert.rejects(llm2.generateJson({ prompt: 'x', schema: receiptSchema }), (e: any) => e.code === 'bad_output');
  await bad.close();
}

// missing model, no vision, unreachable, slow
{
  const missing = await fake((_req, _body, res) => json(res, 404, { error: 'model "nope" not found, try pulling it first' }));
  const llm = createLlm(loadLlmConfig({ OLLAMA_URL: missing.url, OLLAMA_MODEL: 'nope' }));
  await assert.rejects(llm.generateJson({ prompt: 'x', schema: receiptSchema }), (e: any) => e.code === 'model_missing' && /ollama pull nope/.test(e.message));
  await missing.close();

  const blind = await fake((_req, _body, res) => json(res, 400, { error: 'this model does not support image input' }));
  const llm2 = createLlm(loadLlmConfig({ OLLAMA_URL: blind.url, OLLAMA_MODEL: 'texty' }));
  await assert.rejects(llm2.generateJson({ prompt: 'x', schema: receiptSchema, image }), (e: any) => e.code === 'no_vision');
  await blind.close();

  const down = await fake((_req, _body, res) => json(res, 200, {}));
  const deadUrl = down.url;
  await down.close();
  const llm3 = createLlm(loadLlmConfig({ OLLAMA_URL: deadUrl, OLLAMA_MODEL: 'm' }));
  await assert.rejects(llm3.generateJson({ prompt: 'x', schema: receiptSchema }), (e: any) => e.code === 'unreachable');

  const slow = await fake(() => { /* never answers */ });
  const llm4 = createLlm(loadLlmConfig({ OLLAMA_URL: slow.url, OLLAMA_MODEL: 'm', OLLAMA_TIMEOUT_MS: '150' }));
  await assert.rejects(llm4.generateJson({ prompt: 'x', schema: receiptSchema }), (e: any) => e.code === 'timeout');
  await slow.close();
}

// ---- OpenAI-compatible -------------------------------------------------------------
{
  const formats: string[] = [];
  let last: any;
  const server = await fake((req, body, res) => {
    if (req.url === '/v1/models') return json(res, 200, { data: [{ id: 'local-vl' }] });
    formats.push(body.response_format?.type ?? 'none');
    last = body;
    // this server does not know json_schema
    if (body.response_format?.type === 'json_schema') return json(res, 400, { error: { message: "'response_format.type' must be 'json_object' or 'text'" } });
    json(res, 200, { choices: [{ message: { content: '{"store":"Lidl"}' } }] });
  });
  const llm = createLlm(loadLlmConfig({ LLM_BASE_URL: `${server.url}/v1`, LLM_MODEL: 'local-vl', LLM_API_KEY: 'k' }));
  assert.deepEqual(await llm.generateJson({ prompt: 'read', schema: receiptSchema, image }), { store: 'Lidl' });
  assert.deepEqual(formats, ['json_schema', 'json_object']);
  const parts = last.messages[0].content;
  assert.equal(parts[1].image_url.url, 'data:image/jpeg;base64,AAAA');

  const status = await llm.status();
  assert.equal(status.providers[0].ok, true);
  assert.deepEqual(status.providers[0].installed, ['local-vl']);
  const wrong = await createLlm(loadLlmConfig({ LLM_BASE_URL: `${server.url}/v1`, LLM_MODEL: 'other' })).status();
  assert.equal(wrong.providers[0].ok, false);
  await server.close();
}

// ---- fallback chain and status -----------------------------------------------------
{
  const down = await fake((_r, _b, res) => json(res, 200, {}));
  const deadUrl = down.url;
  await down.close();
  const good = await fake((_req, _body, res) => json(res, 200, { choices: [{ message: { content: '{"store":"Coop"}' } }] }));
  const llm = createLlm(loadLlmConfig({
    AI_PROVIDER: 'ollama,openai', OLLAMA_URL: deadUrl, OLLAMA_MODEL: 'm', LLM_BASE_URL: `${good.url}/v1`, LLM_MODEL: 'x',
  }));
  assert.deepEqual(await llm.generateJson({ prompt: 'x', schema: receiptSchema }), { store: 'Coop' }, 'falls back to the next provider');
  await good.close();

  await assert.rejects(createLlm(loadLlmConfig({})).generateJson({ prompt: 'x', schema: receiptSchema }), (e: any) => e.code === 'not_configured');
}
{
  const ollama = await fake((req, _body, res) => {
    if (req.url === '/api/tags') return json(res, 200, { models: [{ name: 'qwen2.5vl:latest' }, { name: 'llama3.2:3b' }] });
    if (req.url === '/api/show') return json(res, 200, { capabilities: ['completion'] });
    json(res, 404, {});
  });
  const good = await createLlm(loadLlmConfig({ OLLAMA_URL: ollama.url, OLLAMA_MODEL: 'llama3.2:3b', OLLAMA_VISION_MODEL: 'qwen2.5vl' })).status();
  // installed, but the vision model says it has no vision capability
  assert.equal(good.providers[0].ok, false);
  assert.ok(good.providers[0].messages.some(m => /vision capability/.test(m)));
  const missing = await createLlm(loadLlmConfig({ OLLAMA_URL: ollama.url, OLLAMA_MODEL: 'gemma3' })).status();
  assert.ok(missing.providers[0].messages.some(m => /ollama pull gemma3/.test(m)));
  await ollama.close();
}

console.log('AI layer checks passed');
