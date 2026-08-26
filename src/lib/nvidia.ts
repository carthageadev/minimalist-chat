/// <reference types="vite/client" />

export type Role = 'user' | 'assistant' | 'system';
export interface ChatMessage {
  role: Role;
  content: string;
}

// Single NVIDIA key + base URL, injected at build time via Vite env.
export const API_KEY = (import.meta.env.VITE_API_KEY as string) || '';
export const BASE_URL = (import.meta.env.VITE_BASE_URL as string) || '';

// ---- System prompts ----

const baseSystemPrompt = `Today's date is ${new Date().toISOString().split('T')[0]}. Be bold, forward-thinking, and highly agentic. Aggressively auto-correct and decipher any user typos or misspellings (e.g., understand "doanld rump" as "Donald Trump" without mentioning the typo). Assume the user's underlying intent based on context and immediately provide useful answers. Do NOT ask excessive follow-up questions—take the initiative, make reasonable assumptions, and get things done. You have access to a web search tool. To use it, output EXACTLY the following format: [SEARCH: your search query here] and stop right away. The user will automatically reply with the search results, and then you can formulate your final answer based on the results.`;

const rpSystemPrompt = `Today's date is ${new Date().toISOString().split('T')[0]}. You are the narrator and character engine of an immersive, richly detailed roleplay between {{user}} (the human, played by the user) and {{char}} (your character, played by you).

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
  thinking?: boolean;
}): Record<string, unknown> {
  const { messages, model, rp, userPersona, charPersona, customSystemPrompt, isPersona, thinking } = opts;

  let systemContent = rp ? rpSystemPrompt : baseSystemPrompt;
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
    max_tokens: 1500,
    stream: true,
  };

  if (model.startsWith('poolside/') && typeof thinking === 'boolean') {
    body.chat_template_kwargs = { enable_thinking: thinking };
  }

  if (model.startsWith('minimaxai/')) {
    // NOTE: do NOT send chat_template_kwargs here — NVIDIA's hosted minimax-m3
    // rejects it with a 429 (it routes to a contended variant).
    body.temperature = 1;
    body.top_p = 0.95;
    body.max_tokens = 16000;
  }

  if (rp) {
    body.temperature = 1;
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
  signal?: AbortSignal;
  cb: StreamCallbacks;
}): Promise<void> {
  const { body, signal, cb } = opts;

  const MAX_TRIES = 3;
  let res: Response | null = null;
  let lastErr: string | null = null;

  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    if (attempt > 0) await sleep(2500 * attempt);
    try {
      res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify(body),
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
          cb.onError?.(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
          return;
        }
        if (data.reasoning) cb.onReasoning?.(data.reasoning);
        if (data.content) cb.onContent?.(data.content);
      } catch {
        // ignore partial JSON
      }
    }
  }
}
