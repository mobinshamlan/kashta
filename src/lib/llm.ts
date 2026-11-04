import "server-only";

/**
 * Llama client. Two providers are supported, both serving Meta's Llama 4 Scout:
 *
 *  - Cloudflare Workers AI (default): free daily allocation.
 *      CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, optional LLAMA_MODEL
 *      (default @cf/meta/llama-4-scout-17b-16e-instruct)
 *  - OpenRouter: LLAMA_PROVIDER=openrouter, OPENROUTER_API_KEY, optional LLAMA_MODEL
 *      (default meta-llama/llama-4-scout)
 *
 * Keys stay on the server. When nothing is configured the AI routes answer
 * `ai_not_configured` and the UI says so; there is no mock response.
 */

export type LlamaProvider = "cloudflare" | "openrouter";

export class LlamaError extends Error {
  constructor(
    public code: "ai_not_configured" | "ai_failed" | "timeout" | "rate_limited",
    message: string,
  ) {
    super(message);
  }
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const TIMEOUT_MS = 30_000;

export function llamaConfig() {
  const provider: LlamaProvider =
    process.env.LLAMA_PROVIDER === "openrouter" ? "openrouter" : "cloudflare";
  if (provider === "openrouter") {
    const key = process.env.OPENROUTER_API_KEY;
    return {
      provider,
      configured: Boolean(key),
      model: process.env.LLAMA_MODEL || "meta-llama/llama-4-scout",
    };
  }
  return {
    provider,
    configured: Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN),
    model: process.env.LLAMA_MODEL || "@cf/meta/llama-4-scout-17b-16e-instruct",
  };
}

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") throw new LlamaError("timeout", "Llama timed out");
    throw new LlamaError("ai_failed", "Could not reach the Llama provider");
  }
  if (res.status === 429) throw new LlamaError("rate_limited", "Llama provider rate limit reached");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`Llama provider answered ${res.status}: ${text.slice(0, 500)}`);
    throw new LlamaError("ai_failed", `Llama provider answered ${res.status}`);
  }
  try {
    return await res.json();
  } catch {
    throw new LlamaError("ai_failed", "Llama provider returned invalid JSON");
  }
}

/** Sends a chat to Llama and returns the raw text (or object, for JSON-mode providers) it produced. */
export async function chatLlama(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<{ content: string; model: string; provider: LlamaProvider }> {
  const cfg = llamaConfig();
  if (!cfg.configured) throw new LlamaError("ai_not_configured", "No Llama provider is configured");
  const maxTokens = opts.maxTokens ?? 900;
  const temperature = opts.temperature ?? 0.2;

  if (cfg.provider === "openrouter") {
    const data = (await post(
      // Any OpenAI-compatible host serving Llama works (LLAMA_BASE_URL); defaults to OpenRouter.
      `${process.env.LLAMA_BASE_URL || "https://openrouter.ai/api/v1"}/chat/completions`,
      {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "X-Title": "KASHTA",
      },
      { model: cfg.model, messages, max_tokens: maxTokens, temperature },
    )) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new LlamaError("ai_failed", "Empty Llama response");
    return { content, model: cfg.model, provider: cfg.provider };
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${cfg.model}`;
  const data = (await post(
    url,
    { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}` },
    { messages, max_tokens: maxTokens, temperature },
  )) as { success?: boolean; result?: { response?: unknown } };
  const response = data.result?.response;
  if (data.success === false || response === undefined || response === null) {
    throw new LlamaError("ai_failed", "Empty Llama response");
  }
  const content = typeof response === "string" ? response : JSON.stringify(response);
  return { content, model: cfg.model, provider: cfg.provider };
}
