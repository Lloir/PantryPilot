// One way to ask an AI for structured JSON, whichever backend is set up:
//   gemini  - Google Gemini (cloud, needs GEMINI_API_KEY)
//   ollama  - a local Ollama server (OLLAMA_URL / OLLAMA_MODEL), reads images with a vision model
//   openai  - any OpenAI-compatible server: LM Studio, llama.cpp, vLLM, LocalAI... (LLM_BASE_URL / LLM_MODEL)
// AI_PROVIDER can list them in the order to try, e.g. "ollama,gemini" (local first, cloud as backup).
import { GoogleGenAI } from '@google/genai';

export type ProviderName = 'gemini' | 'ollama' | 'openai';
export const PROVIDER_NAMES: ProviderName[] = ['gemini', 'ollama', 'openai'];

export interface JsonSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean';
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
}

export interface LlmConfig {
  order: ProviderName[];
  gemini: { apiKey: string; models: string[] };
  ollama: { url: string; model: string; visionModel: string; apiKey: string; numCtx: number; keepAlive: string; timeoutMs: number };
  openai: { baseUrl: string; model: string; visionModel: string; apiKey: string; timeoutMs: number };
}

const clean = (v: string | undefined) => (v ?? '').trim();
const trimSlash = (v: string) => v.replace(/\/+$/, '');
const positiveInt = (v: string | undefined, fallback: number) => {
  const n = Number(clean(v));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

export function loadLlmConfig(env: Record<string, string | undefined>): LlmConfig {
  const ollamaModel = clean(env.OLLAMA_MODEL);
  const openaiModel = clean(env.LLM_MODEL);
  const geminiKey = clean(env.GEMINI_API_KEY);
  const config: LlmConfig = {
    order: [],
    gemini: {
      apiKey: geminiKey,
      models: [clean(env.GEMINI_MODEL), 'gemini-flash-latest', 'gemini-2.5-flash'].filter((m, i, a) => m && a.indexOf(m) === i),
    },
    ollama: {
      // host.docker.internal reaches Ollama running on the Docker host (see README for the Linux/Unraid flag)
      url: trimSlash(clean(env.OLLAMA_URL) || 'http://host.docker.internal:11434'),
      model: ollamaModel,
      visionModel: clean(env.OLLAMA_VISION_MODEL) || ollamaModel,
      apiKey: clean(env.OLLAMA_API_KEY),
      // Ollama's default context is small; receipt images plus the prompt need more
      numCtx: positiveInt(env.OLLAMA_NUM_CTX, 8192),
      keepAlive: clean(env.OLLAMA_KEEP_ALIVE) || '10m',
      // local models on a CPU can take minutes to read a receipt
      timeoutMs: positiveInt(env.OLLAMA_TIMEOUT_MS, 300_000),
    },
    openai: {
      baseUrl: trimSlash(clean(env.LLM_BASE_URL)),
      model: openaiModel,
      visionModel: clean(env.LLM_VISION_MODEL) || openaiModel,
      apiKey: clean(env.LLM_API_KEY),
      timeoutMs: positiveInt(env.LLM_TIMEOUT_MS, 300_000),
    },
  };

  const configured = (name: ProviderName) =>
    name === 'gemini' ? Boolean(config.gemini.apiKey)
    : name === 'ollama' ? Boolean(config.ollama.model)
    : Boolean(config.openai.baseUrl && config.openai.model);

  const asked = clean(env.AI_PROVIDER).toLowerCase().split(/[\s,]+/).filter(Boolean)
    .map(p => (p === 'lmstudio' || p === 'llamacpp' || p === 'local' ? 'openai' : p))
    .filter((p, i, a): p is ProviderName => (PROVIDER_NAMES as string[]).includes(p) && a.indexOf(p) === i);
  // Explicit list wins; otherwise local servers come before the cloud one
  config.order = (asked.length ? asked : (['ollama', 'openai', 'gemini'] as ProviderName[])).filter(configured);
  return config;
}

// --- Errors ------------------------------------------------------------------
export type AiErrorCode = 'unreachable' | 'timeout' | 'model_missing' | 'no_vision' | 'bad_output' | 'rejected' | 'not_configured';
export class AiError extends Error {
  constructor(public code: AiErrorCode, message: string, public provider?: ProviderName) {
    super(message);
  }
}

// Safe to show to anyone in the household (no addresses or keys); admins get the detail in AI status
export function friendlyAiError(e: unknown, task: string): string {
  const code = e instanceof AiError ? e.code : undefined;
  switch (code) {
    case 'not_configured': return 'AI is not set up on the server. An admin can check the AI status in the menu.';
    case 'unreachable': return `The AI server could not be reached, so ${task} failed. An admin can check the AI status in the menu.`;
    case 'timeout': return `The AI took too long to ${task}. A local model can be slow: try again, or ask an admin to raise the time limit.`;
    case 'model_missing': return 'The AI model is not installed on the AI server. An admin can check the AI status in the menu.';
    case 'no_vision': return 'The AI model on the server cannot read images. An admin needs to set a vision model (see AI status in the menu).';
    case 'bad_output': return `The AI answered, but not in a way PantryPal could use to ${task}. Try again, or try a clearer photo.`;
    default: return `The AI could not ${task}. Try again.`;
  }
}

// --- Helpers (exported for tests) ---------------------------------------------
const GEMINI_TYPES = { object: 'OBJECT', array: 'ARRAY', string: 'STRING', number: 'NUMBER', integer: 'INTEGER', boolean: 'BOOLEAN' } as const;
export function toGeminiSchema(s: JsonSchema): any {
  return {
    type: GEMINI_TYPES[s.type],
    ...(s.properties ? { properties: Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toGeminiSchema(v)])) } : {}),
    ...(s.items ? { items: toGeminiSchema(s.items) } : {}),
    ...(s.required ? { required: s.required } : {}),
  };
}

// Local models like to wrap JSON in prose or ``` fences even when told not to
export function parseJsonLoose(text: string): any {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(t);
  } catch {
    const starts = [t.indexOf('{'), t.indexOf('[')].filter(i => i >= 0);
    if (starts.length === 0) throw new AiError('bad_output', 'No JSON in the answer');
    const start = Math.min(...starts);
    const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
    if (end <= start) throw new AiError('bad_output', 'Incomplete JSON in the answer');
    try {
      return JSON.parse(t.slice(start, end + 1));
    } catch {
      throw new AiError('bad_output', 'The answer was not valid JSON');
    }
  }
}

// Local servers handle an object at the top more reliably than an array, so arrays get wrapped
const wrapRoot = (schema: JsonSchema): { schema: JsonSchema; wrapped: boolean } =>
  schema.type === 'array'
    ? { schema: { type: 'object', properties: { items: schema }, required: ['items'] }, wrapped: true }
    : { schema, wrapped: false };

const schemaHint = (schema: JsonSchema) =>
  `\n\nRespond with ONLY valid JSON (no commentary, no markdown) that matches this JSON Schema:\n${JSON.stringify(schema)}`;

function unwrap(value: any, wrapped: boolean) {
  if (!wrapped) return value;
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.items)) return value.items;
  throw new AiError('bad_output', 'Expected a list');
}

async function postJson(url: string, body: unknown, headers: Record<string, string>, timeoutMs: number, provider: ProviderName) {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e: any) {
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') throw new AiError('timeout', `${provider} did not answer within ${Math.round(timeoutMs / 1000)}s`, provider);
    throw new AiError('unreachable', `Could not reach ${url}: ${e?.cause?.code || e?.message || e}`, provider);
  }
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  return { ok: response.ok, status: response.status, data, text };
}

const detail = (r: { data: any; text: string }) =>
  String(r.data?.error?.message ?? r.data?.error ?? r.text ?? '').slice(0, 300);

// --- Request shape ---------------------------------------------------------------
export interface GenerateOptions {
  prompt: string;
  schema: JsonSchema;
  image?: { mimeType: string; base64: string };
  temperature?: number;
  maxTokens?: number;
}

// --- Providers ------------------------------------------------------------------
async function viaOllama(cfg: LlmConfig['ollama'], o: GenerateOptions): Promise<any> {
  const model = o.image ? cfg.visionModel : cfg.model;
  if (!model) throw new AiError('not_configured', 'No Ollama model set', 'ollama');
  const { schema, wrapped } = wrapRoot(o.schema);
  const r = await postJson(`${cfg.url}/api/chat`, {
    model,
    stream: false,
    keep_alive: cfg.keepAlive,
    format: schema,
    messages: [{ role: 'user', content: o.prompt + schemaHint(schema), ...(o.image ? { images: [o.image.base64] } : {}) }],
    options: { temperature: o.temperature ?? 0, num_ctx: cfg.numCtx, ...(o.maxTokens ? { num_predict: o.maxTokens } : {}) },
  }, cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}, cfg.timeoutMs, 'ollama');
  if (!r.ok) {
    const msg = detail(r);
    if (r.status === 404 || /not found/i.test(msg)) throw new AiError('model_missing', `Ollama model "${model}" is not installed (run: ollama pull ${model}). ${msg}`, 'ollama');
    if (/image|vision|multimodal/i.test(msg)) throw new AiError('no_vision', `Model "${model}" cannot read images: ${msg}`, 'ollama');
    throw new AiError('rejected', `Ollama said ${r.status}: ${msg}`, 'ollama');
  }
  const content = r.data?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new AiError('bad_output', 'Ollama sent an empty answer', 'ollama');
  return unwrap(parseJsonLoose(content), wrapped);
}

async function viaOpenAiCompatible(cfg: LlmConfig['openai'], o: GenerateOptions): Promise<any> {
  const model = o.image ? cfg.visionModel : cfg.model;
  const { schema, wrapped } = wrapRoot(o.schema);
  const text = o.prompt + schemaHint(schema);
  const content = o.image
    ? [{ type: 'text', text }, { type: 'image_url', image_url: { url: `data:${o.image.mimeType};base64,${o.image.base64}` } }]
    : text;
  // Servers differ in what they accept: strict schema, plain JSON mode, or nothing
  const formats: any[] = [
    { type: 'json_schema', json_schema: { name: 'result', schema } },
    { type: 'json_object' },
    undefined,
  ];
  let last: AiError | undefined;
  for (const response_format of formats) {
    const r = await postJson(`${cfg.baseUrl}/chat/completions`, {
      model,
      messages: [{ role: 'user', content }],
      temperature: o.temperature ?? 0,
      ...(o.maxTokens ? { max_tokens: o.maxTokens } : {}),
      ...(response_format ? { response_format } : {}),
    }, cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}, cfg.timeoutMs, 'openai');
    if (!r.ok) {
      const msg = detail(r);
      if (r.status === 404 || /model.*(not found|does not exist|not loaded)/i.test(msg)) throw new AiError('model_missing', `Model "${model}" is not available on the server. ${msg}`, 'openai');
      if (o.image && /image|vision|multimodal/i.test(msg)) throw new AiError('no_vision', `Model "${model}" cannot read images: ${msg}`, 'openai');
      last = new AiError('rejected', `Server said ${r.status}: ${msg}`, 'openai');
      if (r.status === 400 || r.status === 422) continue; // try a simpler response format
      throw last;
    }
    const out = r.data?.choices?.[0]?.message?.content;
    if (typeof out !== 'string' || !out.trim()) throw new AiError('bad_output', 'The server sent an empty answer', 'openai');
    return unwrap(parseJsonLoose(out), wrapped);
  }
  throw last ?? new AiError('rejected', 'The server rejected the request', 'openai');
}

let geminiClient: { key: string; client: GoogleGenAI } | null = null;
let geminiWorkingModel: string | null = null;
async function viaGemini(cfg: LlmConfig['gemini'], o: GenerateOptions): Promise<any> {
  if (!geminiClient || geminiClient.key !== cfg.apiKey) geminiClient = { key: cfg.apiKey, client: new GoogleGenAI({ apiKey: cfg.apiKey }) };
  const ai = geminiClient.client;
  // Model names move around; try the configured one, then the moving alias, then a stable one
  const models = geminiWorkingModel ? [geminiWorkingModel, ...cfg.models.filter(m => m !== geminiWorkingModel)] : cfg.models;
  const contents = o.image
    ? { parts: [{ inlineData: { mimeType: o.image.mimeType, data: o.image.base64 } }, { text: o.prompt }] }
    : o.prompt;
  let lastErr: any;
  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          ...(o.temperature !== undefined ? { temperature: o.temperature } : {}),
          ...(o.maxTokens ? { maxOutputTokens: o.maxTokens } : {}),
          responseMimeType: 'application/json',
          responseSchema: toGeminiSchema(o.schema),
          abortSignal: AbortSignal.timeout(45_000),
        },
      });
      geminiWorkingModel = model;
      if (!response.text) throw new AiError('bad_output', 'Gemini sent an empty answer', 'gemini');
      return parseJsonLoose(response.text);
    } catch (e: any) {
      lastErr = e;
      console.error(`Gemini call failed on ${model}:`, e?.message || e);
      // Only try the next model when this one looks missing/unsupported
      if (!/not found|404|not supported|unsupported|NOT_FOUND/i.test(String(e?.message || ''))) break;
    }
  }
  if (lastErr instanceof AiError) throw lastErr;
  if (lastErr?.name === 'TimeoutError' || lastErr?.name === 'AbortError') throw new AiError('timeout', 'Gemini did not answer in time', 'gemini');
  throw new AiError('rejected', `Gemini failed: ${String(lastErr?.message ?? lastErr).slice(0, 300)}`, 'gemini');
}

// --- Public API ----------------------------------------------------------------
export function createLlm(config: LlmConfig) {
  const run = (name: ProviderName, o: GenerateOptions) =>
    name === 'ollama' ? viaOllama(config.ollama, o)
    : name === 'openai' ? viaOpenAiCompatible(config.openai, o)
    : viaGemini(config.gemini, o);

  async function generateJson(o: GenerateOptions): Promise<any> {
    if (config.order.length === 0) throw new AiError('not_configured', 'No AI provider is set up');
    let firstError: AiError | undefined;
    for (const name of config.order) {
      // Local models sometimes fumble the JSON once; one retry is cheap compared with failing
      const attempts = name === 'gemini' ? 1 : 2;
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          return await run(name, o);
        } catch (e: any) {
          const err = e instanceof AiError ? e : new AiError('rejected', String(e?.message ?? e), name);
          console.error(`AI (${name}) failed${attempt < attempts ? ', retrying' : ''}:`, err.message);
          firstError ??= err;
          if (err.code !== 'bad_output') break;
        }
      }
    }
    throw firstError!;
  }

  return {
    config,
    enabled: config.order.length > 0,
    providers: config.order,
    generateJson,
    status: () => aiStatus(config),
  };
}
export type Llm = ReturnType<typeof createLlm>;

// --- Status for the admin screen ------------------------------------------------
export interface ProviderStatus {
  provider: ProviderName;
  ok: boolean;
  model: string;
  visionModel: string;
  messages: string[];
  installed?: string[];
}

const sameModel = (installed: string, wanted: string) =>
  installed === wanted || installed === `${wanted}:latest` || (!wanted.includes(':') && installed.startsWith(`${wanted}:`));

async function getJson(url: string, headers: Record<string, string>, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, headers: { ...headers, ...(init.headers as any) }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`${response.status}`);
  return response.json() as Promise<any>;
}

async function aiStatus(config: LlmConfig): Promise<{ providers: ProviderStatus[]; order: ProviderName[] }> {
  const out: ProviderStatus[] = [];
  for (const name of config.order) {
    if (name === 'gemini') {
      out.push({ provider: 'gemini', ok: true, model: config.gemini.models[0], visionModel: config.gemini.models[0], messages: ['API key is set. Press Test to check it works.'] });
    } else if (name === 'ollama') {
      const c = config.ollama;
      const s: ProviderStatus = { provider: 'ollama', ok: false, model: c.model, visionModel: c.visionModel, messages: [] };
      const headers: Record<string, string> = c.apiKey ? { Authorization: `Bearer ${c.apiKey}` } : {};
      try {
        const tags = await getJson(`${c.url}/api/tags`, headers);
        s.installed = (tags.models ?? []).map((m: any) => String(m.name));
        s.ok = true;
        for (const [label, model] of [['Text model', c.model], ['Vision model', c.visionModel]] as const) {
          if (label === 'Vision model' && c.visionModel === c.model) continue;
          if (!s.installed!.some(i => sameModel(i, model))) {
            s.ok = false;
            s.messages.push(`${label} "${model}" is not installed. Run: ollama pull ${model}`);
          }
        }
        // Newer Ollama versions list what a model can do; warn when the receipt model cannot see
        try {
          const shown = await getJson(`${c.url}/api/show`, headers, { method: 'POST', body: JSON.stringify({ model: c.visionModel }), headers: { 'Content-Type': 'application/json' } });
          if (Array.isArray(shown.capabilities) && !shown.capabilities.includes('vision')) {
            s.ok = false;
            s.messages.push(`"${c.visionModel}" does not list the vision capability, so it cannot read receipts. Set OLLAMA_VISION_MODEL to a vision model.`);
          }
        } catch { /* older servers: no capability list */ }
        if (s.ok) s.messages.push('Reachable, and the configured models are installed.');
      } catch (e: any) {
        s.messages.push(`Could not reach Ollama at ${c.url} (${e?.cause?.code || e?.message || e}). From Docker use --add-host=host.docker.internal:host-gateway, or set OLLAMA_URL to the server's address.`);
      }
      out.push(s);
    } else {
      const c = config.openai;
      const s: ProviderStatus = { provider: 'openai', ok: false, model: c.model, visionModel: c.visionModel, messages: [] };
      try {
        const list = await getJson(`${c.baseUrl}/models`, c.apiKey ? { Authorization: `Bearer ${c.apiKey}` } : {});
        s.installed = (list.data ?? []).map((m: any) => String(m.id));
        s.ok = true;
        for (const model of new Set([c.model, c.visionModel])) {
          if (s.installed!.length && !s.installed!.includes(model)) {
            s.ok = false;
            s.messages.push(`Model "${model}" is not in the server's model list.`);
          }
        }
        if (s.ok) s.messages.push('Reachable.');
      } catch (e: any) {
        s.messages.push(`Could not reach ${c.baseUrl} (${e?.cause?.code || e?.message || e}).`);
      }
      out.push(s);
    }
  }
  return { providers: out, order: config.order };
}
