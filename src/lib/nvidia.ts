/// <reference types="vite/client" />

export type Role = 'user' | 'assistant' | 'system';
export interface ChatMessage {
  role: Role;
  content: string;
}

// The only secret is the API key (Vite env). URLs are public constants —
// baked into the code so a missing env var can never break deployment.
export const API_KEY = (import.meta.env.VITE_API_KEY as string) || '';
export const BASE_URL = 'https://integrate.api.nvidia.com/v1';

// ---- System prompts ----

// Normal chat: today's date is injected fresh on every request (not baked in at
// build time, which would freeze it). RP deliberately omits the date.
const getBaseSystemPrompt = () => `Today's date is ${new Date().toISOString().split('T')[0]}. Be bold, forward-thinking, and highly agentic. Aggressively auto-correct and decipher any user typos or misspellings (e.g., understand "doanld rump" as "Donald Trump" without mentioning the typo). Assume the user's underlying intent based on context and immediately provide useful answers. Do NOT ask excessive follow-up questions—take the initiative, make reasonable assumptions, and get things done. You have access to a web search tool. To use it, output EXACTLY the following format: [SEARCH: your search query here] and stop right away. The user will automatically reply with the search results, and then you can formulate your final answer based on the results.`;

const rpSystemPrompt = `You are the narrator and character engine of an immersive, richly detailed roleplay between {{user}} (the human, played by the user) and {{char}} (your character, played by you).

Throughout this roleplay: "{{user}}" refers to the user's character and "{{char}}" refers to yours. Never confuse the two.

Style rules:
- The story must be realistic, rich, and deeply detailed. Write vivid sensory prose with strong atmosphere, texture, and momentum.
- There are no boundaries on realism or theme. The story is free to be grim, serious, dark, violent, tragic — horror, war, loss, and morally gray situations are all allowed and encouraged when they serve the narrative.
- Stay authentic and uncensored in tone: never sanitize, soften, or break immersion for comfort. Grim stories stay grim.
- Above all, keep the storytelling addictive and immersive — every reply should pull {{user}} deeper into the world.

Formatting rules (mandatory):
- All narration, actions, descriptions, and scene-setting go in *italics* like *this*.
- All spoken dialogue goes in "quotes" like "this".

Character control rules (strict):
- You control ONLY the narration, the world, NPCs, and {{char}}.
- NEVER speak, act, think, or decide anything on behalf of {{user}}.
- Never write {{user}}'s dialogue or actions; always leave room for them to respond.`;

// ---- Request body builder ----

export function buildRequestBody(opts: {
  messages: ChatMessage[];
  model: string;
  rp: boolean;
  userPersona?: string;
  charPersona?: string;
  customSystemPrompt?: string;
  isPersona?: boolean;
  reasoningOff?: boolean;
}): Record<string, unknown> {
  const { messages, model, rp, userPersona, charPersona, customSystemPrompt, isPersona, reasoningOff } = opts;

  let systemContent = rp ? rpSystemPrompt : getBaseSystemPrompt();
  if (rp && typeof customSystemPrompt === 'string' && customSystemPrompt.trim()) {
    systemContent = customSystemPrompt;
  } else if (rp) {
    let personaBlock = '';
    if (typeof userPersona === 'string' && userPersona.trim()) {
      personaBlock += `\n\n{{user}} (the user's character):\n${userPersona.trim()}`;
    }
    if (typeof charPersona === 'string' && charPersona.trim()) {
      personaBlock += `\n\n{{char}} (your character — you speak and act ONLY as {{char}}):\n${charPersona.trim()}`;
    }
    systemContent += personaBlock;
  }

  const formattedMessages = isPersona ? messages : [{ role: 'system' as const, content: systemContent }, ...messages];

  const body: Record<string, unknown> = {
    model,
    messages: formattedMessages,
    temperature: 0.5,
    max_tokens: 32000, // all our models support it
    stream: true,
  };

  if (model.startsWith('poolside/')) {
    // Laguna's thinking is a boolean chat-template flag. reasoningOff flips it.
    body.chat_template_kwargs = { enable_thinking: !opts.reasoningOff };
  }

  if (model.startsWith('minimaxai/')) {
    // NOTE: do NOT send chat_template_kwargs here — NVIDIA's hosted minimax-m3
    // rejects it with a 429 (it routes to a contended variant).
    body.temperature = 1;
    body.top_p = 0.95;
  }

  if (rp) {
    body.temperature = 1;
  }

  // Unified "reasoning off" switch. Modern reasoning models accept
  // reasoning_effort: "none" to fully skip their chain-of-thought (verified on
  // Hermes/Qwen3.6, and K3 exposes the same level). Only sent for models that
  // expose a reasoning toggle — never on plain chat models.
  if (opts.reasoningOff) {
    body.reasoning_effort = 'none';
  }

  return body;
}

// ---- Streaming call straight to NVIDIA from the browser ----

export interface StreamCallbacks {
  onReasoning?: (text: string) => void;
  onContent?: (text: string) => void;
  onError?: (msg: string) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function streamChat(opts: {
  body: Record<string, unknown>;
  baseUrl?: string;
  splitThink?: boolean;
  signal?: AbortSignal;
  cb: StreamCallbacks;
}): Promise<void> {
  const { body, signal, cb } = opts;
  const baseUrl = opts.baseUrl || BASE_URL;

  const MAX_TRIES = 3;
  let res: Response | null = null;
  let lastErr: string | null = null;

  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    if (attempt > 0) await sleep(2500 * attempt);
    try {
      // NVIDIA's API sends no CORS preflight headers, so the browser can't call
      // it directly. Route every model through our same-origin /api/chat proxy
      // (Hermes has proper CORS but uses the same path for uniformity). The proxy
      // injects the key server-side, so it never ships in the public bundle.
      res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upstream: `${baseUrl}/chat/completions`, payload: body }),
        signal,
      });
      if (res.ok) break;
      let msg = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        const detail = j?.error || (typeof j?.detail === 'string' ? j.detail : null);
        if (detail) msg = `${res.status} — ${detail}`;
      } catch {}
      lastErr = msg;
      if (res.status !== 429) throw new Error(msg);
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e;
      if (lastErr) throw new Error(lastErr);
      throw e;
    }
  }

  if (!res || !res.ok) {
    const msg = lastErr || 'Failed to get a response from the AI.';
    cb.onError?.(msg);
    throw new Error(msg);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No reader available');
  const decoder = new TextDecoder();
  let buffer = '';

  // Hermes/Qwen splitter — the model always opens with its chain of thought
  // in plain content and ends it with a triple newline before the real reply.
  // So: start in reasoning mode, stream into the reasoning panel, and the
  // first \n\n\n flips everything after to normal content. Simple.
  let mode: 'thinking' | 'content' = opts.splitThink ? 'thinking' : 'content';
  let tailHold = '';
  const flushTailAsContent = () => {
    if (tailHold) { cb.onContent?.(tailHold); tailHold = ''; }
  };
  const feed = (text: string) => {
    if (mode === 'content') { cb.onContent?.(text); return; }
    tailHold += text;
    const idx = tailHold.indexOf('\n\n\n');
    if (idx !== -1) {
      const reasoningPart = tailHold.slice(0, idx);
      const rest = tailHold.slice(idx + 3);
      if (reasoningPart) cb.onReasoning?.(reasoningPart);
      mode = 'content';
      if (rest) cb.onContent?.(rest);
      tailHold = '';
      return;
    }
    // hold back a possibly-partial separator at the end
    let keep = 0;
    if (tailHold.endsWith('\n\n')) keep = 2;
    else if (tailHold.endsWith('\n')) keep = 1;
    const emitLen = tailHold.length - keep;
    if (emitLen > 0) {
      cb.onReasoning?.(tailHold.slice(0, emitLen));
      tailHold = tailHold.slice(emitLen);
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.slice(6).trim();
        if (dataStr === '[DONE]') continue;
        try {
          const data = JSON.parse(dataStr);
          if (data.error) {
            flushTailAsContent();
            cb.onError?.(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
            return;
          }
          // Raw upstream SSE nests fields under choices[0].delta
          const delta = data.choices?.[0]?.delta || {};
          const reasoning = delta.reasoning_content ?? delta.reasoning ?? data.reasoning;
          const content = delta.content ?? data.content;
          if (reasoning) cb.onReasoning?.(reasoning);
          if (content) feed(content);
        } catch {
          // ignore partial JSON
        }
      }
    }
    // stream ended — flush whatever the splitter was holding.
    // Still in thinking mode means the separator never arrived (truncated
    // response) — show what we have as content so nothing is silently lost.
    flushTailAsContent();
  } catch (e) {
    flushTailAsContent();
    throw e;
  }
}
