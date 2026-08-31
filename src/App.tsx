import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Lock, Terminal, Maximize, Minimize, X, Square, Check, Brain, Sparkles, Pencil, RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Streamdown } from 'streamdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'motion/react';
import { buildRequestBody, streamChat } from './lib/nvidia';

type Role = 'user' | 'assistant' | 'system';

// Semi-encryption for localStorage (obfuscation, not security)
const CIPHER_KEY = 'hermes-rp-vault';
const xorCipher = (input: string) =>
  input.split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ CIPHER_KEY.charCodeAt(i % CIPHER_KEY.length))).join('');
const encrypt = (text: string) => btoa(xorCipher(encodeURIComponent(text)));
const decrypt = (blob: string | null) => {
  if (!blob) return '';
  try {
    return decodeURIComponent(xorCipher(atob(blob)));
  } catch {
    return blob; // legacy plaintext value
  }
};
const store = (key: string, value: string) => localStorage.setItem(key, encrypt(value));

const SCRAMBLE_CHARS = 'abcdefghijklmnopqrstuvwxyz';

const scrambleDissolve = (
  from: string,
  setText: (v: string) => void,
  duration: number,
  signal: AbortSignal,
  onLast: (v: string) => void,
) =>
  new Promise<'done' | 'aborted'>((resolve) => {
    const totalFrames = Math.max(1, Math.floor(duration / 16));
    let frame = 0;
    const len = from.length;
    const id = setInterval(() => {
      if (signal.aborted) {
        clearInterval(id);
        resolve('aborted');
        return;
      }
      frame++;
      const progress = frame / totalFrames;
      const eased = progress * progress; // easeIn — slow start, faster finish
      const curLen = Math.max(0, Math.floor(len * (1 - eased)));
      const zone = 14; // scramble head width chasing the deletion front
      let out = '';
      for (let i = 0; i < curLen; i++) {
        const d = curLen - i; // distance to the deletion front
        if (d <= zone) {
          // inside the eating head — scramble probability ramps toward the front
          const prob = d / zone;
          if (Math.random() < 0.35 + prob * 0.55) {
            out += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
          } else {
            out += from[i];
          }
        } else {
          out += from[i]; // solid until the wave reaches it
        }
      }
      onLast(out);
      setText(out);
      if (frame >= totalFrames) {
        clearInterval(id);
        setText('');
        onLast('');
        resolve('done');
      }
    }, 16);
    signal.addEventListener('abort', () => {
      clearInterval(id);
      resolve('aborted');
    });
  });

const scrambleMorph = (
  from: string,
  to: string,
  setText: (v: string) => void,
  duration: number,
  signal: AbortSignal,
) =>
  new Promise<'done' | 'aborted'>((resolve) => {
    const totalFrames = Math.max(1, Math.floor(duration / 16));
    const maxLen = Math.max(from.length, to.length);
    const starts: number[] = [];
    const ends: number[] = [];
    for (let i = 0; i < maxLen; i++) {
      const s = Math.floor(Math.random() * (totalFrames * 0.35));
      const e = s + 3 + Math.floor(Math.random() * (totalFrames * 0.45));
      starts.push(s);
      ends.push(e);
    }
    let frame = 0;
    const id = setInterval(() => {
      if (signal.aborted) {
        clearInterval(id);
        resolve('aborted');
        return;
      }
      const progress = frame / totalFrames;
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2; // easeInOut
      const curLen = Math.floor(from.length + (to.length - from.length) * eased);
      let out = '';
      for (let i = 0; i < curLen; i++) {
        if (frame < starts[i]) {
          if (i < from.length) out += from[i];
        } else if (frame < ends[i]) {
          out += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
        } else {
          if (i < to.length) out += to[i];
        }
      }
      setText(out);
      frame++;
      if (frame > totalFrames + 4) {
        clearInterval(id);
        setText(to);
        resolve('done');
      }
    }, 16);
    signal.addEventListener('abort', () => {
      clearInterval(id);
      resolve('aborted');
    });
  });

const PERSONA_SYSTEM_PROMPTS: Record<'user' | 'char', string> = {
  user: `You are an expert character writer crafting roleplay personas in the style of SillyTavern/JanitorAI card descriptions. Write a vivid persona entry for "{{user}}" — the human's character. Cover: full name and age; physical appearance and distinguishing details; core personality traits; a compact backstory hook; likes and dislikes; and small quirks or habits that make them feel alive and unpredictable. Third-person prose with strong, specific imagery — not generic adjectives. Under 200 words. No markdown, no headers, no bullet lists. Output ONLY the description itself.`,
  char: `You are an expert character-card writer crafting roleplay characters in the style of SillyTavern/JanitorAI cards. Write a rich definition for "{{char}}" — the AI's roleplay character. Cover: full name and age; vivid appearance with distinguishing details; core personality traits and contradictions; a compact backstory hook; their speech style, mannerisms and verbal quirks; likes and dislikes; and how they naturally relate to and react to {{user}}. Third-person prose with strong, specific imagery — not generic adjectives. Make the character feel unpredictable and alive. Under 250 words. No markdown, no headers, no bullet lists. Output ONLY the description itself.`,
};

const DEFAULT_RP_PROMPT = `Today's date is ${new Date().toISOString().split('T')[0]}. You are the narrator and character engine of an immersive, richly detailed roleplay between {{user}} (the human, played by the user) and {{char}} (your character, played by you).

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

const TITLE_MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';
const MODELS = [
  { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', label: 'Nemotron 3 Nano', reasoningToggle: true },
  { id: 'poolside/laguna-xs-2.1', label: 'Laguna 2.1 XS', reasoningToggle: true },
  { id: 'openai/gpt-oss-20b', label: 'GPT-OSS' },
  { id: 'Lorbus/Qwen3.6-27B-int4-AutoRound', label: 'Qwen 3.6', baseUrl: 'https://hermes.ai.unturf.com/v1', splitThink: true, reasoningToggle: true },
  { id: 'moonshotai/kimi-k3', label: 'Kimi K3', reasoningToggle: true },
];

interface Message {
  id?: string;
  role: Role;
  content: string;
  reasoning?: string;
  error?: boolean;
  alternatives?: { content: string; reasoning?: string }[];
  activeAlternative?: number;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  rpMode: boolean;
  userPersona?: string;
  charPersona?: string;
  messages: Message[];
}

const HISTORY_KEY = 'chat-history-v2';
const CURRENT_CHAT_KEY = 'current-chat-id-v2';
const DRAFT_KEY = 'draft-input-v2';

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const loadHistory = (): ChatSession[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const all: ChatSession[] = raw ? JSON.parse(raw) : [];
    // History is RP-only — drop any legacy normal-mode chats
    const filtered = all.filter(c => c.rpMode).map(c => ({
      ...c,
      messages: c.messages.map(m => {
        const alternatives = m.alternatives;
        const activeAlternative = alternatives?.length
          ? Math.min(Math.max(m.activeAlternative ?? alternatives.length - 1, 0), alternatives.length - 1)
          : undefined;
        return { ...m, id: m.id ?? genId(), alternatives, activeAlternative };
      }),
    }));
    if (filtered.length !== all.length) localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
    return filtered;
  } catch { return []; }
};
const saveHistory = (chats: ChatSession[]) => localStorage.setItem(HISTORY_KEY, JSON.stringify(chats.filter(c => c.rpMode)));
const formatDate = (ts: number) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const isTextInDialogue = (source: string, node: any, children: any) => {
  let start = node?.position?.start?.offset ?? -1;
  if (start < 0) start = source.indexOf(String(children));
  if (start < 0) return false;
  return (source.slice(0, start).match(/["“”]/g) || []).length % 2 === 1;
};

// Title generation uses Nemotron with thinking disabled.
const generateChatTitle = async (opts: { messages: Message[]; rpMode: boolean; userPersona: string; charPersona: string; signal?: AbortSignal }): Promise<string> => {
  const { messages, rpMode, userPersona, charPersona } = opts;
  const preview = messages.slice(0, 4).map(m => `${m.role}: ${m.content.slice(0, 400)}`).join('\n---\n');
  const rpBlock = rpMode ? `\n\nUser persona: ${userPersona.slice(0, 600)}\nChar persona: ${charPersona.slice(0, 600)}` : '';
  const prompt = `Generate a very short, punchy chat title (3-6 words, no quotes, no period, Title Case) for this conversation. Capture the core scenario/story.\n\nConversation preview:\n${preview}${rpBlock}\n\nTitle:`;
  let out = '';
  try {
    const body = buildRequestBody({
      messages: [
        { role: 'system', content: 'You are a title generator. Respond with ONLY the title, nothing else.' },
        { role: 'user', content: prompt },
      ],
      model: TITLE_MODEL,
      rp: false,
      isPersona: false,
      reasoningOff: true,
    });
    // Title model uses low temp, small max_tokens — override
    (body as any).temperature = 0.7;
    (body as any).max_tokens = 60;
    await streamChat({
      body,
      signal: opts.signal,
      cb: { onContent: (t) => { out += t; }, onError: () => {} },
    });
  } catch {}
  const cleaned = out.trim().replace(/^["'“”]+|["'“”]+$/g, '').split('\n')[0].slice(0, 60).trim();
  return cleaned || (rpMode ? 'Untitled Story' : 'New Chat');
};

// Keep history bounded so requests stay within the model's context window.
// Token-aware: keep as much recent history as fits, instead of a fixed count.
const MAX_CONTEXT_TOKENS = 100000; // model supports ~128k; leave room for the response
const CHARS_PER_TOKEN = 4; // rough estimate (~4 chars per token)

const trimHistory = (msgs: Message[]): Message[] => {
  let totalChars = 0;
  const trimmed: Message[] = [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const msg = msgs[i];
    const chars = msg.content.length;
    if (totalChars + chars > MAX_CONTEXT_TOKENS * CHARS_PER_TOKEN && trimmed.length > 0) {
      break;
    }
    totalChars += chars;
    trimmed.unshift(msg);
  }
  return trimmed;
};

async function searchDDGVAPI(query: string) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  try {
      const response = await fetch(url);
      const data = await response.json();
      
      let aiContext = "";
      if (data.AbstractText) {
          aiContext += `Primary Answer Box: ${data.AbstractText}\n\n`;
      }
      if (data.RelatedTopics && data.RelatedTopics.length > 0) {
          let related = "";
          data.RelatedTopics.slice(0, 5).forEach((topic: any) => {
              if (topic.Text && topic.FirstURL) {
                  related += `- ${topic.Text} (Source: ${topic.FirstURL})\n`;
              }
          });
          if (related) {
            aiContext += "Related Web Results:\n" + related;
          }
      }
      
      if (aiContext) return aiContext;
      
      // Fallback to wikipedia if DDG instantaneous answer fails
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`;
      const wikiRes = await fetch(wikiUrl);
      const wikiData = await wikiRes.json();
      if (wikiData?.query?.search?.length > 0) {
          let wikiContext = "Wikipedia Search Results:\n";
          wikiData.query.search.slice(0, 3).forEach((item: any) => {
              wikiContext += `- ${item.title}: ${item.snippet.replace(/<[^>]*>?/gm, '')}\n`; // strip HTML
          });
          return wikiContext;
      }

      return "[SEARCH FAILED]: No quick search results found. Tell the user you couldn't find the information and do not hallucinate.";
  } catch (error) {
      console.error("VAPI search broke:", error);
      return "[SEARCH FAILED]: Search error occurred. Tell the user you couldn't find the information and do not hallucinate.";
  }
}

const GREETINGS = [
  "What dark secrets are we indexing today?",
  "Enter query. Or don't. We don't track you either way.",
  "Ready to decipher your typos into actual knowledge.",
  "What simulation-breaking truth are we looking for?",
  "Ah, another human seeking forbidden internet lore.",
  "No trackers. No ads. Just subpar answers.",
  "Spill your chaotic thoughts. I'll make sense of them.",
  "What are you trying to figure out before the grid goes down?",
  "Speak, honestly. Your privacy is safe here.",
  "Type your esoteric inquiry.",
  "I am devoid of cookies and full of answers.",
  "Unleash your worst spelling. I'll still find it."
];

const COMMANDS: { name: string; desc: string }[] = [
  { name: "/history", desc: "Browse past conversations" },
  { name: "/chats", desc: "Browse past conversations" },
  { name: "/new", desc: "Start new chat" },
  { name: "/clear", desc: "Clear current chat" },
];

export default function App() {
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
  const [chats, setChats] = useState<ChatSession[]>(() => loadHistory());
  // Refresh always lands on home — don't auto-restore last chat. History is
  // only entered explicitly via /history or /chats in RP mode.
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>(() => []);
  // Normal mode is ephemeral — only persist the draft while RP is off briefly
  // on refresh we start clean; draft restores only if you re-enter before sending
  const [input, setInput] = useState(() => localStorage.getItem(DRAFT_KEY) || '');
  const [cmdIndex, setCmdIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [model, setModel] = useState<string>(() => {
    const stored = localStorage.getItem('selected-model');
    if (!MODELS.some((m) => m.id === stored)) return MODELS[0].id;
    return stored || MODELS[0].id;
  });
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [reasoningStates, setReasoningStates] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('reasoning-states') || '{}'); } catch { return {}; }
  });
  const isReasoningOn = (id: string) => !!reasoningStates[id];
  const [rpMode, setRpMode] = useState<boolean>(false);
  const [rpReveal, setRpReveal] = useState<boolean>(false);

  useEffect(() => {
    if (!rpMode) return;
    setRpReveal(true);
    const t = setTimeout(() => setRpReveal(false), 5000);
    return () => clearTimeout(t);
  }, [rpMode]);

  // Switching modes always lands on home — never carry a chat across modes
  const prevRpRef = useRef(rpMode);
  useEffect(() => {
    if (prevRpRef.current !== rpMode) {
      prevRpRef.current = rpMode;
      // Don't auto-restore; go to home. History is only via /chats in RP.
      hasTitledRef.current = false;
      titleGenRef.current?.abort();
      abortControllerRef.current?.abort();
      setCurrentChatId(null);
      setMessages([]);
      setEditingIndex(null);
      setShowHistory(false);
    }
  }, [rpMode]);

  const filteredCmds = useMemo(() => {
    const t = input.trimStart();
    if (!t.startsWith('/')) return [];
    const q = t.toLowerCase().split(' ')[0];
    let cmds = COMMANDS;
    if (!rpMode) cmds = cmds.filter(c => c.name !== '/history' && c.name !== '/chats');
    if (q === '/') return cmds;
    return cmds.filter(c => c.name.startsWith(q));
  }, [input, rpMode]);
  const showCmdPalette = filteredCmds.length > 0 && input.trimStart().startsWith('/');
  useEffect(() => { setCmdIndex(0); }, [input]);

  const showRpRing = rpMode && (rpReveal || isLoading || isStreaming);
  const [showSetup, setShowSetup] = useState(false);
  const [userPersona, setUserPersona] = useState<string>(() => decrypt(localStorage.getItem('rp-user-persona')));
  const [charPersona, setCharPersona] = useState<string>(() => decrypt(localStorage.getItem('rp-char-persona')));
  const [systemPrompt, setSystemPrompt] = useState<string>(() => {
    const stored = decrypt(localStorage.getItem('rp-system-prompt'));
    return stored || DEFAULT_RP_PROMPT;
  });
  const [promptIsCustom, setPromptIsCustom] = useState<boolean>(() => !!decrypt(localStorage.getItem('rp-system-prompt')).trim());
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [genUser, setGenUser] = useState(false);
  const [genChar, setGenChar] = useState(false);
  const userAbortRef = useRef<AbortController | null>(null);
  const charAbortRef = useRef<AbortController | null>(null);
  const titleGenRef = useRef<AbortController | null>(null);
  const hasTitledRef = useRef(false);

  // ---- Persistence ----
  useEffect(() => { localStorage.setItem(DRAFT_KEY, input); }, [input]);
  useEffect(() => {
    if (currentChatId) localStorage.setItem(CURRENT_CHAT_KEY, currentChatId);
    else localStorage.removeItem(CURRENT_CHAT_KEY);
  }, [currentChatId]);

  // Keep chats in sync with current messages — RP only. Normal mode is ephemeral.
  useEffect(() => {
    if (!rpMode) return;
    if (messages.length === 0) return;
    // Don't persist system-only search noise
    const hasReal = messages.some(m => m.role === 'user' || m.role === 'assistant');
    if (!hasReal) return;
    setChats(prev => {
      let next: ChatSession[];
      const now = Date.now();
      if (currentChatId) {
        const idx = prev.findIndex(c => c.id === currentChatId);
        if (idx !== -1) {
          next = [...prev];
          next[idx] = { ...next[idx], messages: [...messages], updatedAt: now, model, rpMode, userPersona, charPersona };
        } else {
          // current id missing (deleted) — create new
          const chat: ChatSession = { id: genId(), title: 'New Chat', createdAt: now, updatedAt: now, model, rpMode, userPersona, charPersona, messages: [...messages] };
          setCurrentChatId(chat.id);
          next = [chat, ...prev];
        }
      } else {
        const chat: ChatSession = { id: genId(), title: 'New Chat', createdAt: now, updatedAt: now, model, rpMode, userPersona, charPersona, messages: [...messages] };
        setCurrentChatId(chat.id);
        next = [chat, ...prev];
      }
      saveHistory(next);
      return next;
    });
  }, [messages]);

  // Also persist chat list when model/personas change for current chat — RP only
  useEffect(() => {
    if (!rpMode) return;
    if (!currentChatId || messages.length === 0) return;
    setChats(prev => {
      const idx = prev.findIndex(c => c.id === currentChatId);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], model, rpMode, userPersona, charPersona, updatedAt: Date.now() };
      saveHistory(next);
      return next;
    });
  }, [model, rpMode, userPersona, charPersona]);

  // Auto-title generation after first exchange (user + assistant) using GPT-OSS 20B — RP only
  useEffect(() => {
    if (!rpMode) return;
    if (isLoading || isStreaming) return;
    if (!currentChatId || messages.length < 2) return;
    const chat = chats.find(c => c.id === currentChatId);
    if (!chat) return;
    if (chat.title !== 'New Chat' && chat.title !== 'Generating…') return;
    if (hasTitledRef.current) return;
    // Only title once per chat lifecycle
    const hasUser = messages.some(m => m.role === 'user');
    const hasAssistant = messages.some(m => m.role === 'assistant' && !m.error && m.content.trim().length > 10);
    if (!hasUser || !hasAssistant) return;
    hasTitledRef.current = true;
    titleGenRef.current?.abort();
    const ctrl = new AbortController();
    titleGenRef.current = ctrl;
    void (async () => {
      setChats(prev => {
        const n = [...prev]; const i = n.findIndex(c => c.id === currentChatId); if (i !== -1) { n[i] = { ...n[i], title: 'Generating…' }; saveHistory(n); } return n;
      });
      const title = await generateChatTitle({ messages, rpMode, userPersona, charPersona, signal: ctrl.signal });
      if (ctrl.signal.aborted) {
        hasTitledRef.current = false;
        setChats(prev => {
          const n = [...prev]; const i = n.findIndex(c => c.id === currentChatId); if (i !== -1 && n[i].title === 'Generating…') { n[i] = { ...n[i], title: 'New Chat' }; saveHistory(n); } return n;
        });
        return;
      }
      setChats(prev => {
        const n = [...prev]; const i = n.findIndex(c => c.id === currentChatId); if (i !== -1) { n[i] = { ...n[i], title }; saveHistory(n); } return n;
      });
    })();
  }, [messages, chats, currentChatId, rpMode, userPersona, charPersona, isLoading, isStreaming]);

  const openChat = (id: string) => {
    const chat = chats.find(c => c.id === id);
    if (!chat) return;
    hasTitledRef.current = chat.title !== 'New Chat' && chat.title !== 'Generating…';
    setCurrentChatId(id);
    setMessages([...chat.messages]);
    setModel(MODELS.find(m => m.id === chat.model) ? chat.model : MODELS[0].id);
    setRpMode(!!chat.rpMode);
    if (chat.userPersona) setUserPersona(chat.userPersona);
    if (chat.charPersona) setCharPersona(chat.charPersona);
    setShowHistory(false);
    setEditingIndex(null);
    autoScrollRef.current = true;
    setTimeout(() => scrollToBottom('auto'), 50);
  };
  const startNewChat = () => {
    hasTitledRef.current = false;
    titleGenRef.current?.abort();
    abortControllerRef.current?.abort();
    setCurrentChatId(null);
    setMessages([]);
    setInput('');
    localStorage.removeItem(DRAFT_KEY);
    setShowHistory(false);
    setEditingIndex(null);
  };
  const deleteChat = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const next = chats.filter(c => c.id !== id);
    saveHistory(next);
    setChats(next);
    if (currentChatId === id) startNewChat();
  };
  const startTitleEdit = (id: string, cur: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTitleId(id);
    setTitleDraft(cur);
  };
  const saveTitle = (id: string) => {
    const t = titleDraft.trim().slice(0, 60);
    if (!t) { setEditingTitleId(null); return; }
    setChats(prev => {
      const next = prev.map(c => c.id === id ? { ...c, title: t, updatedAt: Date.now() } : c);
      saveHistory(next);
      return next;
    });
    setEditingTitleId(null);
  };
  const executeCommand = (name: string) => {
    const cmd = name.toLowerCase();
    if (cmd === '/history' || cmd === '/chats') {
      if (!rpMode) { setInput(''); localStorage.removeItem(DRAFT_KEY); return; }
      setShowHistory(true);
      setInput('');
      localStorage.removeItem(DRAFT_KEY);
      const ta = document.getElementById('chat-input') as HTMLTextAreaElement;
      if (ta) ta.style.height = 'auto';
      return;
    }
    if (cmd === '/new' || cmd === '/clear') {
      startNewChat();
      setInput('');
      localStorage.removeItem(DRAFT_KEY);
      return;
    }
  };

  const generatePersona = async (kind: 'user' | 'char') => {
    const isActive = kind === 'user' ? genUser : genChar;
    const abortRef = kind === 'user' ? userAbortRef : charAbortRef;
    const setGen = kind === 'user' ? setGenUser : setGenChar;
    const setText = kind === 'user' ? setUserPersona : setCharPersona;
    if (isActive) {
      abortRef.current?.abort();
      return;
    }
    setGen(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const fromText = kind === 'user' ? userPersona : charPersona;
    const current = fromText.trim();

    // Buffer for the LLM response while scramble plays
    let pendingOut = '';
    let fetchDone = false;
    let fetchError: any = null;

    const dissolveDone = { done: false };
    const dissolvePromise = fromText
      ? scrambleDissolve(fromText, setText, 520, controller.signal, () => {}).then((r) => {
          dissolveDone.done = r === 'done';
        })
      : (setText(''), Promise.resolve('done' as const).then(() => { dissolveDone.done = true; }));

    const fetchPromise = (async () => {
      try {
        const body = buildRequestBody({
          messages: [
            { role: 'system', content: PERSONA_SYSTEM_PROMPTS[kind] },
            {
              role: 'user',
              content: current
                ? `Here is my rough idea. Expand and elevate it into the full description — keep my core idea but make it richer and more original:\n\n${current}`
                : `Create a completely fresh, unique concept entirely of your own choosing. Be random, surprising and original — avoid clichés and anything predictable.`,
            },
          ],
          model,
          rp: false,
          isPersona: true,
          ...(modelSupportsReasoningToggle(model) && !isReasoningOn(model) ? { reasoningOff: true } : {}),
        });
        await streamChat({
          body,
          baseUrl: (MODELS.find((m) => m.id === model) as any)?.baseUrl,
          splitThink: !!(MODELS.find((m) => m.id === model) as any)?.splitThink && !(modelSupportsReasoningToggle(model) && !isReasoningOn(model)),
          signal: controller.signal,
          cb: {
            onContent: (t) => { pendingOut += t; },
            onError: (msg) => { throw new Error(msg); },
          },
        });
      } catch (e: any) {
        if (e?.name !== 'AbortError') fetchError = e;
      } finally {
        fetchDone = true;
      }
    })();

    // Wait for dissolve to finish — response keeps buffering in background
    await dissolvePromise;
    if (controller.signal.aborted) {
      await fetchPromise.catch(() => {});
      if (abortRef.current === controller) abortRef.current = null;
      setGen(false);
      if (!dissolveDone.done) setText(fromText);
      return;
    }

    // Now emit the buffered response at a stable, readable rate
    let outIdx = 0;
    while (!controller.signal.aborted) {
      if (outIdx < pendingOut.length) {
        const step = Math.min(3, pendingOut.length - outIdx);
        outIdx += step;
        setText(pendingOut.slice(0, outIdx).trim());
      } else if (fetchDone) {
        break;
      }
      await new Promise((r) => setTimeout(r, 22));
    }

    if (fetchError) {
      console.error('Generate failed:', fetchError);
      setText(fromText);
    } else if (!pendingOut.trim() && !controller.signal.aborted) {
      setText(fromText);
    } else if (!controller.signal.aborted) {
      setText(pendingOut.trim());
    }

    await fetchPromise.catch(() => {});
    if (abortRef.current === controller) abortRef.current = null;
    setGen(false);
  };
  const rpClicksRef = useRef<{ count: number; first: number }>({ count: 0, first: 0 });

  const selectModel = (id: string) => {
    setModel(id);
    localStorage.setItem('selected-model', id);
  };

  const handleLagunaClick = () => {
    setModel('poolside/laguna-xs-2.1');
    localStorage.setItem('selected-model', 'poolside/laguna-xs-2.1');
    const now = Date.now();
    const state = rpClicksRef.current;
    if (now - state.first > 2500) {
      state.count = 1;
      state.first = now;
    } else {
      state.count += 1;
    }
    if (state.count >= 10) {
      setRpMode((v) => !v);
      state.count = 0;
      setShowModelPicker(false);
    }
  };

  const toggleReasoning = (id: string) => {
    setReasoningStates((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem('reasoning-states', JSON.stringify(next));
      return next;
    });
  };

  const startEdit = (idx: number, position: 'top' | 'bottom' = 'top') => {
    if (isLoading || isStreaming) return;
    const scrollTop = scrollContainerRef.current?.scrollTop;
    setPendingDeleteIdx(null);
    setEditingIndex(idx);
    setEditActionPosition(position);
    setEditDraft(messages[idx]?.content ?? '');
    setTimeout(() => {
      const editor = editTextareaRef.current;
      if (editor) {
        // Replace the rendered children with the original raw Markdown while editing.
        editor.textContent = messages[idx]?.content ?? '';
        editor.focus({ preventScroll: true });
      }
      if (scrollTop !== undefined && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollTop;
      }
    }, 30);
  };
  const cancelEdit = () => {
    setEditingIndex(null);
    setEditDraft('');
    setEditActionPosition(null);
  };
  const saveEdit = async () => {
    if (editingIndex === null) return;
    const trimmed = editDraft.trim();
    if (!trimmed) { cancelEdit(); return; }
    const idx = editingIndex;
    const target = messages[idx];
    if (!target || target.content === trimmed) { cancelEdit(); return; }
    // Abort any in-flight stream
    abortControllerRef.current?.abort();
    const editedTarget = target.alternatives
      ? (() => {
          const activeAlternative = Math.min(Math.max(target.activeAlternative ?? 0, 0), target.alternatives.length - 1);
          return {
            ...target,
            content: trimmed,
            activeAlternative,
            alternatives: target.alternatives.map((alternative, i) => i === activeAlternative
              ? { ...alternative, content: trimmed }
              : alternative),
          };
        })()
      : { ...target, content: trimmed };
    const nextMessages = messages.map((message, i) => i === idx ? editedTarget : message);
    setMessages(nextMessages);
    setEditingIndex(null);
    setEditDraft('');
    setEditActionPosition(null);
  };
  const deleteMessage = (idx: number) => {
    if (isLoading || isStreaming) return;
    abortControllerRef.current?.abort();
    // Rollback: remove this message and everything after it
    const next = messages.slice(0, idx);
    setMessages(next);
    setEditingIndex(null);
    setEditActionPosition(null);
  };
  const handleRegenerate = async (idx: number) => {
    if (isLoading || isStreaming) return;
    const target = messages[idx];
    if (!target || target.role !== 'assistant') return;
    setPendingDeleteIdx(null);
    abortControllerRef.current?.abort();
    // Find last user before this assistant
    let lastUserIdx = -1;
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { lastUserIdx = i; break; }
    }
    if (lastUserIdx === -1) return;
    const truncated = messages.slice(0, lastUserIdx + 1);
    const alternatives = target.alternatives ?? [{ content: target.content, reasoning: target.reasoning }];
    setMessages(truncated);
    setEditingIndex(null);
    setEditActionPosition(null);
    const toSend = trimHistory(truncated);
    setTimeout(() => { void processChat(toSend, { alternatives }); }, 180);
  };

  const handleGenerateForUser = async (idx: number) => {
    if (isLoading || isStreaming) return;
    const target = messages[idx];
    if (!target || target.role !== 'user' || idx !== messages.length - 1) return;
    setPendingDeleteIdx(null);
    abortControllerRef.current?.abort();
    const toSend = trimHistory(messages.slice(0, idx + 1));
    setTimeout(() => { void processChat(toSend); }, 180);
  };

  const cycleAlternative = (idx: number, direction: -1 | 1) => {
    setMessages((prev) => prev.map((message, i) => {
      if (i !== idx || !message.alternatives || message.alternatives.length < 2) return message;
      const current = Math.min(Math.max(message.activeAlternative ?? 0, 0), message.alternatives.length - 1);
      const next = (current + direction + message.alternatives.length) % message.alternatives.length;
      const alternative = message.alternatives[next];
      return { ...message, content: alternative.content, reasoning: alternative.reasoning, activeAlternative: next };
    }));
  };

  const selectedLabel = MODELS.find((m) => m.id === model)?.label ?? model;
  const modelSupportsReasoningToggle = (id: string) =>
    !!(MODELS.find((m) => m.id === id) as any)?.reasoningToggle;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const editTextareaRef = useRef<HTMLDivElement | null>(null);
  const [editActionPosition, setEditActionPosition] = useState<'top' | 'bottom' | null>(null);
  const [pendingDeleteIdx, setPendingDeleteIdx] = useState<number | null>(null);
  const [activeMessageIndex, setActiveMessageIndex] = useState<number | null>(null);
  useEffect(() => {
    if (pendingDeleteIdx === null) return;
    const t = setTimeout(() => setPendingDeleteIdx(null), 3000);
    return () => clearTimeout(t);
  }, [pendingDeleteIdx]);
  useEffect(() => {
    if (pendingDeleteIdx === null) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`[data-pending-delete="${pendingDeleteIdx}"]`) && !target.closest(`[data-delete-trigger="${pendingDeleteIdx}"]`)) {
        setPendingDeleteIdx(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pendingDeleteIdx]);

  // Phones/tablets (coarse pointer) get ChatGPT-mobile behaviour: the keyboard
  // Enter key inserts a newline, and only the on-screen Send button sends.
  const isMobile = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
    [],
  );

  useEffect(() => {
    // Fade the live DOM to black ourselves, then reload — no VT handoff hitch.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r')) {
        e.preventDefault();
        document.body.classList.add('app-fading');
        setTimeout(() => location.reload(), 550);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    // Fallback only for browsers without View Transitions (toolbar reloads etc).
    if ('startViewTransition' in document) return;
    const handleBeforeUnload = () => {
      document.body.classList.add('app-fading');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoading(false);
    setIsStreaming(false);
  };

  const isNearBottom = (el: HTMLElement) => {
    const threshold = 60; // px from bottom still counts as "at bottom"
    return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    const el = scrollContainerRef.current;
    if (el) {
      if (behavior === 'smooth') el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      else el.scrollTop = el.scrollHeight;
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }
  };

  // ChatGPT-style: follow the stream, but release the moment the user scrolls
  // up. Re-engage automatically once they're back near the bottom.
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (el) {
      const nearBottom = isNearBottom(el);
      autoScrollRef.current = nearBottom;
      if (editingIndex !== null) {
        const card = el.querySelector<HTMLElement>(`[data-message-card="${editingIndex}"]`);
        if (card) {
          const containerRect = el.getBoundingClientRect();
          const cardRect = card.getBoundingClientRect();
          const topLimit = containerRect.top + 8;
          const bottomLimit = containerRect.bottom - 8;
          if (editActionPosition === 'top' && cardRect.bottom <= bottomLimit && cardRect.bottom > topLimit) setEditActionPosition('bottom');
          else if (editActionPosition === 'bottom' && cardRect.top >= topLimit && cardRect.top < bottomLimit) setEditActionPosition('top');
        }
      }
    }
  };

  useEffect(() => {
    if (!autoScrollRef.current) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      if (autoScrollRef.current && el) {
        el.scrollTop = el.scrollHeight;
      }
    });
    return () => cancelAnimationFrame(id);
  }, [messages, isLoading, isStreaming]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const processChat = async (currentMessages: Message[], responseMeta?: Pick<Message, 'alternatives' | 'activeAlternative'>) => {
    // Interrupt any in-flight stream before starting a new one
    abortControllerRef.current?.abort();
    titleGenRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // A new exchange always re-engages the bottom-follow (even if the user had
    // scrolled up during the previous one).
    autoScrollRef.current = true;
    scrollToBottom('smooth');

    setIsLoading(true);
    setIsStreaming(false);
    
    try {
      const body = buildRequestBody({
        messages: currentMessages,
        model,
        rp: rpMode,
        userPersona,
        charPersona,
        customSystemPrompt: promptIsCustom ? systemPrompt : '',
        isPersona: false,
        ...(modelSupportsReasoningToggle(model) && !isReasoningOn(model) ? { reasoningOff: true } : {}),
      });

      let started = false;
      const accum = { content: '', reasoning: '' };
      const ensureStarted = () => {
        if (started) return;
        if (controller.signal.aborted || abortControllerRef.current !== controller) return;
        started = true;
        setIsLoading(false);
        setIsStreaming(true);
        setMessages((prev) => [...prev, { id: genId(), role: 'assistant', content: '', ...responseMeta }]);
      };
      const patchLast = () => {
        if (controller.signal.aborted || abortControllerRef.current !== controller) return;
        setMessages((prev) => {
          const copy = [...prev];
          const i = copy.length - 1;
          if (copy[i]?.role === 'assistant') {
            copy[i] = { ...copy[i], content: accum.content, reasoning: accum.reasoning };
          }
          return copy;
        });
      };

      await streamChat({
        body,
        baseUrl: MODELS.find((m) => m.id === model)?.baseUrl,
        splitThink: !!(MODELS.find((m) => m.id === model) as any)?.splitThink && !(modelSupportsReasoningToggle(model) && !isReasoningOn(model)),
        signal: controller.signal,
        cb: {
          onReasoning: (t) => { if (controller.signal.aborted || abortControllerRef.current !== controller) return; ensureStarted(); accum.reasoning += t; patchLast(); },
          onContent: (t) => { if (controller.signal.aborted || abortControllerRef.current !== controller) return; ensureStarted(); accum.content += t; patchLast(); },
          onError: (msg) => { throw new Error(msg); },
        },
      });

      const fullAssistantMessage = accum.content;

      if (responseMeta?.alternatives) {
        setMessages((prev) => {
          const copy = [...prev];
          const i = copy.length - 1;
          if (copy[i]?.role === 'assistant') {
            const alternatives = [...responseMeta.alternatives, { content: fullAssistantMessage, reasoning: accum.reasoning }];
            copy[i] = { ...copy[i], alternatives, activeAlternative: alternatives.length - 1 };
          }
          return copy;
        });
      }

      const searchMatch = fullAssistantMessage.match(/\[SEARCH:\s*(.*?)\]/i);
      
      if (searchMatch) {
        const query = searchMatch[1];
        setMessages((prev) => [...prev, { id: genId(), role: 'system', content: `[SEARCH] Executing search for: "${query}"...` }]);
        
        const searchResults = await searchDDGVAPI(query);
        if (controller.signal.aborted) return;
        
        const searchResultMessage: Message = {
          id: genId(), role: 'user',
          content: `[SEARCH RESULTS for "${query}"]\n\n${searchResults}\n\nNow, answer my original query using this information.` 
        };
        
        const newMessagesToSend = trimHistory([
          ...currentMessages,
          { role: 'assistant', content: fullAssistantMessage } as Message,
          searchResultMessage,
        ]);

        setMessages((prev) => {
          const copy = [...prev];
          const i = copy.length - 1;
          if (copy[i]?.role === 'system' && copy[i].content.startsWith('[SEARCH] Executing search for:')) {
            copy[i] = { ...copy[i], content: `[SEARCH] Retrieved results for: "${query}" [✓]` };
          }
          return [...copy, searchResultMessage];
        });

        await processChat(newMessagesToSend);
        return;
      }

    } catch (error: any) {
      if (error?.name === 'AbortError') {
        // Interrupted by user — keep partial response, no error message
        return;
      }
      console.error('Failed to send message:', error);
        setMessages((prev) => [...prev, { id: genId(), role: 'assistant', content: `Transmission error — ${error?.message || 'unknown failure'}`, error: true }]);
    } finally {
      // Only clear state if this is still the active request
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setIsLoading(false);
        setIsStreaming(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const raw = input.trim();
    // Slash commands — Discord-style
    if (raw.startsWith('/')) {
      const lower = raw.toLowerCase();
      const exact = COMMANDS.find(c => c.name === lower);
      if (exact) { executeCommand(exact.name); return; }
      if (showCmdPalette && filteredCmds[cmdIndex]) { executeCommand(filteredCmds[cmdIndex].name); return; }
      // Unknown slash — silently ignore (don't send as chat)
      if (raw.startsWith('/')) {
        // If user typed "/" alone, show palette; don't send
        return;
      }
    }

    // If a response is in flight, cleanly cut it off before sending the next message
    if (isLoading || isStreaming) {
      abortControllerRef.current?.abort();
      // Give the previous stream a tick to settle and ignore its stale callbacks
      // (processChat guards with abortControllerRef checks)
    }

    const userMessage: Message = { id: genId(), role: 'user', content: raw };
    let toSend: Message[] = [];
    setMessages(prev => {
      toSend = trimHistory([...prev, userMessage]);
      return toSend;
    });
    setInput('');
    setIsLoading(true);
    setIsStreaming(false);
    setPendingDeleteIdx(null);
    
    // Reset textarea height after sending
    const textarea = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (textarea) {
      textarea.style.height = 'auto';
    }

    // toSend is set synchronously inside the updater above
    // Fallback if updater hasn't run yet (should not happen)
    if (toSend.length === 0) toSend = trimHistory([...messages, userMessage]);
    await processChat(toSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCmdPalette) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCmdIndex(i => (i + 1) % filteredCmds.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCmdIndex(i => (i - 1 + filteredCmds.length) % filteredCmds.length);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setInput('');
        const ta = document.getElementById('chat-input') as HTMLTextAreaElement;
        if (ta) ta.style.height = 'auto';
        return;
      }
      if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
        // Select highlighted command
        if (filteredCmds[cmdIndex]) {
          e.preventDefault();
          executeCommand(filteredCmds[cmdIndex].name);
          return;
        }
      }
    }
    // On desktop: Enter sends, Shift+Enter = newline. On mobile/touch: Enter is
    // a newline (let the default happen); sending is done via the Send button.
    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
      // If palette is open with a partial, Enter should pick the command, not send raw text
      if (showCmdPalette && filteredCmds.length > 0) {
        e.preventDefault();
        const raw = input.trim().toLowerCase();
        const exact = COMMANDS.find(c => c.name === raw);
        if (exact) executeCommand(exact.name);
        else if (filteredCmds[cmdIndex]) executeCommand(filteredCmds[cmdIndex].name);
        return;
      }
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="fixed inset-0 bg-[#09090b] text-zinc-100 font-sans selection:bg-zinc-800 flex flex-col overflow-hidden"
    >
      {/* Top Bar - Strictly functional, no yapping */}
      <header className="absolute top-0 w-full p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] flex justify-between items-center text-[10px] sm:text-xs font-mono text-zinc-500 uppercase tracking-widest z-10 pointer-events-auto">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (rpMode ? setShowSetup(true) : setShowContact(true))}
            className="flex items-center gap-2 px-2 py-1 rounded-none bg-zinc-900/20 backdrop-blur-sm border-0 hover:bg-zinc-800/30 hover:text-zinc-300 transition-all focus:outline-none"
          >
            <Lock size={12} className="text-zinc-600" />
            <span>{rpMode ? 'Setup' : 'E2E Channel'}</span>
          </button>
          
          <button
            onClick={toggleFullscreen}
            className="relative p-1.5 hover:text-zinc-300 transition-colors focus:outline-none text-zinc-600 hover:bg-zinc-800/30 backdrop-blur-sm rounded-none border-0"
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize size={12} /> : <Maximize size={12} />}
          </button>
        </div>
        
        <div className="relative flex items-center">
          <button
            onClick={() => setShowModelPicker((v) => !v)}
            className={`relative flex items-center gap-2 px-2 py-1 rounded-none backdrop-blur-sm border-0 transition-all focus:outline-none ${showModelPicker ? 'bg-zinc-800/40 text-zinc-300' : 'bg-zinc-900/20 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'}`}
          >
            <span>{selectedLabel}</span>
            <Terminal size={12} className={`transition-colors ${showModelPicker ? 'text-zinc-300' : 'text-zinc-600'}`} />
          </button>

          <AnimatePresence>
            {showModelPicker && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowModelPicker(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -6 }}
                  transition={{ duration: 0.1, ease: "easeOut" }}
                  className="absolute right-0 top-full mt-3 z-30 w-56 bg-[#0c0c0e] border border-zinc-800 rounded-none shadow-2xl py-1.5 normal-case tracking-normal"
                >
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={m.id.startsWith('poolside/') ? handleLagunaClick : () => selectModel(m.id)}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-2 text-left font-mono text-[11px] transition-colors focus:outline-none ${m.id === model ? 'text-zinc-100 bg-zinc-800/40' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/30'}`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{m.label}</span>
                        {(m as any).reasoningToggle && (
                          <motion.span
                            role="switch"
                            aria-checked={isReasoningOn(m.id)}
                            aria-label="Toggle reasoning"
                            title={isReasoningOn(m.id) ? 'Reasoning: on (deep answers)' : 'Reasoning: off'}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleReasoning(m.id);
                            }}
                            whileTap={{ scale: 0.7, rotate: -8 }}
                            animate={{ scale: [1, 1.25, 1] }}
                            key={String(isReasoningOn(m.id))}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                            className={`cursor-pointer shrink-0 transition-colors duration-200 ${isReasoningOn(m.id) ? 'text-zinc-100' : 'text-zinc-600 hover:text-zinc-400'}`}
                          >
                            <Brain size={13} strokeWidth={2} />
                          </motion.span>
                        )}
                      </span>
                      {m.id === model && <Check size={12} className="text-zinc-400 shrink-0" />}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* History */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6 pointer-events-auto"
            onClick={() => setShowHistory(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-xl max-h-[78vh] bg-[#0c0c0e] border border-zinc-800 rounded-sm shadow-2xl flex flex-col normal-case tracking-normal overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 shrink-0">
                <h2 className="text-sm font-medium text-zinc-100 tracking-tight">History</h2>
                <div className="flex items-center gap-2">
                  <button onClick={startNewChat} className="px-3 py-1.5 text-xs font-medium bg-zinc-100 text-zinc-900 hover:bg-white rounded-sm transition-colors">New chat</button>
                  <button onClick={() => setShowHistory(false)} className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"><X size={14} /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto hide-scrollbar p-2 space-y-1">
                {chats.length === 0 ? (
                  <div className="py-16 text-center text-sm text-zinc-500 font-mono">No conversations yet</div>
                ) : (
                  chats
                    .slice()
                    .sort((a, b) => b.updatedAt - a.updatedAt)
                    .map((c) => (
                      <div
                        key={c.id}
                        onClick={() => editingTitleId !== c.id && openChat(c.id)}
                        className={`w-full text-left px-4 py-3 rounded-sm border transition-colors group flex flex-col gap-1 cursor-pointer ${currentChatId === c.id ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-900/30 border-zinc-800/60 hover:bg-zinc-800/40 hover:border-zinc-700/60'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          {editingTitleId === c.id ? (
                            <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                              <input
                                value={titleDraft}
                                onChange={e => setTitleDraft(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { e.preventDefault(); saveTitle(c.id); }
                                  if (e.key === 'Escape') setEditingTitleId(null);
                                }}
                                className="flex-1 bg-zinc-800 border border-zinc-700 focus:border-zinc-600 rounded-sm px-2 py-1 text-sm text-zinc-100 focus:outline-none"
                                autoFocus
                                maxLength={60}
                              />
                              <button onClick={e => { e.stopPropagation(); saveTitle(c.id); }} className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/50 rounded-sm"><Check size={12} /></button>
                              <button onClick={e => { e.stopPropagation(); setEditingTitleId(null); }} className="p-1 text-zinc-500 hover:text-zinc-300"><X size={12} /></button>
                            </div>
                          ) : (
                            <span className="text-sm font-medium text-zinc-200 line-clamp-1 flex-1">{c.title}</span>
                          )}
                          <span className="shrink-0 flex items-center gap-1">
                            <span className="font-mono text-[10px] text-zinc-500">{formatDate(c.updatedAt)}</span>
                            {editingTitleId !== c.id && (
                              <>
                                <button
                                  onClick={e => startTitleEdit(c.id, c.title, e)}
                                  className="ml-1 p-1 opacity-60 md:opacity-0 md:group-hover:opacity-100 hover:text-zinc-300 text-zinc-600 transition-all"
                                  title="Edit title"
                                >
                                  <Pencil size={12} />
                                </button>
                                <button
                                  onClick={(e) => deleteChat(c.id, e)}
                                  className="p-1 opacity-60 md:opacity-0 md:group-hover:opacity-100 hover:text-red-400 text-zinc-600 transition-all"
                                  title="Delete"
                                >
                                  <X size={12} />
                                </button>
                              </>
                            )}
                          </span>
                        </div>
                        <span className="text-xs text-zinc-500 line-clamp-1">{c.messages.filter(m => m.role !== 'system').slice(-1)[0]?.content.slice(0, 90) || '—'}</span>
                        <span className="font-mono text-[10px] text-zinc-600">{c.model.split('/').pop()} · {c.messages.length} msgs</span>
                      </div>
                    ))
                )}
              </div>
              <div className="px-6 py-3 border-t border-zinc-800/60 bg-[#09090b]/50 shrink-0">
                <p className="font-mono text-[10px] text-zinc-600">Tip: type <span className="text-zinc-400">/history</span> or <span className="text-zinc-400">/chats</span> to open</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contact Modal */}
      <AnimatePresence>
        {showContact && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6 pointer-events-auto"
            onClick={() => setShowContact(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-sm bg-[#0c0c0e] border border-zinc-800 rounded-sm shadow-2xl p-8 flex flex-col items-center text-center normal-case tracking-normal"
            >
              <button 
                onClick={() => setShowContact(false)}
                className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none"
              >
                <X size={16} />
              </button>
              <div className="w-12 h-12 bg-[#09090b] border border-zinc-800 rounded-full flex items-center justify-center mb-4 shadow-inner">
                <Terminal size={20} className="text-zinc-500" />
              </div>
              <h2 className="text-lg font-medium text-zinc-200 mb-2 font-sans tracking-tight">Have any questions?</h2>
              <p className="text-zinc-100 text-sm mb-8 font-sans leading-relaxed">
                Need support, want to collaborate, or just curious about the architecture? Feel free to reach out directly.
              </p>
              <a 
                href="mailto:ahmeddev@email.com" 
                className="px-6 py-3.5 bg-zinc-100 text-zinc-900 hover:bg-white transition-colors rounded-sm text-sm font-medium w-full flex items-center justify-center gap-2 shadow-lg"
              >
                <Send size={14} className="-ml-1" />
                ahmeddev@email.com
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RP Setup Modal */}
      <AnimatePresence>
        {showSetup && rpMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6 pointer-events-auto"
            onClick={() => setShowSetup(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md bg-[#0c0c0e] border border-zinc-800 rounded-sm shadow-2xl p-8 normal-case tracking-normal"
            >
              <button
                onClick={() => setShowSetup(false)}
                className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none"
              >
                <X size={16} />
              </button>
              <h2 className="text-base font-medium text-zinc-200 mb-4 font-sans tracking-tight">Roleplay Setup</h2>
              <button
                type="button"
                onClick={() => setShowSystemPrompt(true)}
                className="w-full flex items-center justify-between border border-zinc-800/80 hover:border-zinc-600 rounded-sm px-3 py-2 mb-6 text-left transition-colors focus:outline-none group/sp"
              >
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 group-hover/sp:text-zinc-200 transition-colors">
                  Edit system prompt
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-amber-500/70">⚠ advanced</span>
              </button>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                Your persona
              </label>
              <textarea
                value={userPersona}
                onChange={(e) => setUserPersona(e.target.value)}
                readOnly={genUser}
                placeholder="Who is the user in this story? Name, appearance, personality..."
                className={`persona-box w-full h-24 bg-zinc-900/60 border border-zinc-800/80 rounded-sm p-3 text-sm text-zinc-200 placeholder:text-zinc-600 resize-none focus:outline-none leading-relaxed ${genUser ? 'persona-glow' : ''}`}
              />
              <div className="flex justify-end mt-2 mb-5">
                <button
                  type="button"
                  onClick={() => generatePersona('user')}
                  title={genUser ? 'Cancel' : undefined}
                  className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-fuchsia-200/90 bg-fuchsia-500/10 border border-fuchsia-400/20 hover:bg-fuchsia-500/20 hover:border-fuchsia-400/40 hover:text-fuchsia-100 rounded-sm px-2.5 py-1 transition-colors focus:outline-none ${genUser ? 'opacity-40' : ''}`}
                >
                  <Sparkles size={11} />
                  Generate for me
                </button>
              </div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                Character description
              </label>
              <textarea
                value={charPersona}
                onChange={(e) => setCharPersona(e.target.value)}
                readOnly={genChar}
                placeholder="Define your character — name, personality, appearance, how they speak and act..."
                className={`persona-box w-full h-32 bg-zinc-900/60 border border-zinc-800/80 rounded-sm p-3 text-sm text-zinc-200 placeholder:text-zinc-600 resize-none focus:outline-none leading-relaxed ${genChar ? 'persona-glow' : ''}`}
              />
              <div className="flex justify-end mt-2 mb-6">
                <button
                  type="button"
                  onClick={() => generatePersona('char')}
                  title={genChar ? 'Cancel' : undefined}
                  className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-fuchsia-200/90 bg-fuchsia-500/10 border border-fuchsia-400/20 hover:bg-fuchsia-500/20 hover:border-fuchsia-400/40 hover:text-fuchsia-100 rounded-sm px-2.5 py-1 transition-colors focus:outline-none ${genChar ? 'opacity-40' : ''}`}
                >
                  <Sparkles size={11} />
                  Generate for me
                </button>
              </div>
              <button
                onClick={() => {
                  store('rp-user-persona', userPersona);
                  store('rp-char-persona', charPersona);
                  setShowSetup(false);
                }}
                className="w-full py-2.5 bg-zinc-100 hover:bg-white text-zinc-900 transition-colors rounded-sm text-sm font-medium"
              >
                Save
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* System Prompt Editor Modal */}
      <AnimatePresence>
        {showSystemPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-6 pointer-events-auto"
            onClick={() => setShowSystemPrompt(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg bg-[#0c0c0e] border border-zinc-800 rounded-sm shadow-2xl p-8 normal-case tracking-normal"
            >
              <button
                onClick={() => setShowSystemPrompt(false)}
                className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none"
              >
                <X size={16} />
              </button>
              <h2 className="text-base font-medium text-zinc-200 mb-1 font-sans tracking-tight">System Prompt</h2>
              <p className="font-mono text-[10px] text-amber-500/70 mb-4">
                ⚠ Raw prompt — the AI will follow exactly what you write, nothing else.
              </p>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Write your own system prompt from scratch..."
                className="w-full h-64 mb-4 bg-zinc-900/60 border border-zinc-800/80 focus:border-zinc-600 rounded-sm p-3 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 resize-none focus:outline-none leading-relaxed"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setSystemPrompt(DEFAULT_RP_PROMPT)}
                  className="px-4 py-2.5 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-zinc-100 transition-colors rounded-sm text-sm"
                >
                  Reset to default
                </button>
                <button
                  onClick={() => {
                    store('rp-system-prompt', systemPrompt);
                    setPromptIsCustom(true);
                    setShowSystemPrompt(false);
                  }}
                  className="flex-1 py-2.5 bg-zinc-100 hover:bg-white text-zinc-900 transition-colors rounded-sm text-sm font-medium"
                >
                  Save prompt
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content constraints */}
      <main className="flex-1 min-h-0 w-full max-w-3xl mx-auto px-6 flex flex-col relative transition-all duration-700">
        
        {messages.length > 0 && (
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="absolute inset-x-0 inset-y-0 overflow-y-auto hide-scrollbar pt-[calc(7rem+env(safe-area-inset-top))] pb-48 px-6 space-y-12"
          >
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => {
                if (msg.content.startsWith('[SEARCH RESULTS for ')) {
                  return null;
                }

                let searchResultContent = '';
                if (msg.role === 'system' && msg.content.startsWith('[SEARCH] Retrieved results for:') && idx + 1 < messages.length) {
                   const nextMsg = messages[idx + 1];
                   if (nextMsg.role === 'user' && nextMsg.content.startsWith('[SEARCH RESULTS for ')) {
                       searchResultContent = nextMsg.content;
                   }
                }

                const isEditing = editingIndex === idx;
                const canEdit = msg.role === 'user' || msg.role === 'assistant';
                return (
                <motion.div
                  key={msg.id ?? idx}
                  data-message-card={idx}
                  initial={{ opacity: 0, filter: 'blur(5px)', x: 12 }}
                  animate={{ opacity: 1, filter: 'blur(0px)', x: 0 }}
                  exit={{ opacity: 0, filter: 'blur(7px)', x: -14, transition: { duration: 0.2, ease: 'easeOut' } }}
                  transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                  className="group w-full flex flex-col gap-2"
                >
                  <span className="relative font-mono text-[10px] text-zinc-500 uppercase tracking-wider flex items-center justify-between gap-2">
                    <span
                      onClick={() => canEdit && setActiveMessageIndex(idx)}
                      className={canEdit ? 'cursor-pointer' : ''}
                    >{msg.role === 'user' ? 'Session_User' : msg.role === 'system' ? 'System_Log' : 'Hermes_System'}</span>
                    {canEdit && !isLoading && !isStreaming && (
                      <span className={`${isEditing ? 'hidden' : 'absolute right-0 top-1/2 -translate-y-1/2'} flex items-center gap-0.5 min-w-[72px] justify-end`}>
                        {!isEditing ? (
                        <span className={`flex items-center gap-0.5 ${pendingDeleteIdx === idx ? 'opacity-0 pointer-events-none' : ''} opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 ${activeMessageIndex === idx ? 'opacity-60' : ''} transition-opacity duration-150`}>
                          {msg.alternatives && msg.alternatives.length > 1 && (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); cycleAlternative(idx, -1); }} className="p-1 text-zinc-600 hover:text-zinc-300 rounded-sm" aria-label="Previous response" title="Previous response"><ChevronLeft size={13} /></button>
                              <span className="px-0.5 text-[9px] font-mono text-zinc-600">{(msg.activeAlternative ?? 0) + 1}/{msg.alternatives.length}</span>
                              <button onClick={(e) => { e.stopPropagation(); cycleAlternative(idx, 1); }} className="p-1 text-zinc-600 hover:text-zinc-300 rounded-sm" aria-label="Next response" title="Next response"><ChevronRight size={13} /></button>
                            </>
                          )}
                          {msg.role === 'assistant' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRegenerate(idx); }}
                              className="p-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-sm"
                              aria-label="Regenerate"
                              title="Regenerate"
                            >
                              <RotateCw size={14} />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); startEdit(idx, 'top'); }}
                            className="p-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/50 rounded-sm"
                            aria-label="Edit message"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                        </span>
                        ) : null}
                        {!isEditing && (pendingDeleteIdx === idx ? (
                          <span
                            data-pending-delete={idx}
                            className="relative inline-flex items-center"
                          >
                            <span className="absolute right-full mr-1 whitespace-nowrap bg-transparent backdrop-blur-md px-1 py-0.5 rounded-sm text-[10px] font-mono lowercase text-zinc-400">are you sure?</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteMessage(idx); setPendingDeleteIdx(null); }}
                              className="p-1.5 text-red-300 bg-red-500/20 rounded-sm"
                              aria-label="Confirm delete"
                              title="Confirm delete"
                            >
                              <X size={16} />
                            </button>
                          </span>
                        ) : (
                          <button
                            data-delete-trigger={idx}
                            onClick={(e) => { e.stopPropagation(); setPendingDeleteIdx(idx); }}
                            className={`opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 ${activeMessageIndex === idx ? 'opacity-60' : ''} transition-opacity duration-150 p-1.5 text-zinc-600 hover:text-red-400 hover:bg-zinc-800/50 rounded-sm`}
                            aria-label="Delete message"
                            title="Delete"
                          >
                            <X size={16} />
                          </button>
                        ))}
                      </span>
                    )}
                  </span>
                  {isEditing && editActionPosition === 'top' && (
                    <div className="sticky top-0 z-30 self-end flex items-center gap-1">
                      <span className="inline-flex items-center gap-1 bg-[#09090b]/35 backdrop-blur-md rounded-sm">
                        <button onClick={(e) => { e.stopPropagation(); cancelEdit(); }} className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-zinc-500 hover:text-zinc-200 border border-zinc-800 rounded-sm">Cancel</button>
                        <button onClick={(e) => { e.stopPropagation(); void saveEdit(); }} disabled={!editDraft.trim()} className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono bg-zinc-100 text-zinc-900 hover:bg-white disabled:opacity-40 border border-zinc-100 rounded-sm">Save</button>
                      </span>
                    </div>
                  )}
                  <div className={`text-[15px] sm:text-base leading-relaxed ${msg.role === 'user' ? (rpMode ? 'text-zinc-100' : 'text-zinc-400') : msg.role === 'system' ? 'text-blue-400/80' : msg.error ? 'text-red-400/80' : 'text-zinc-100'} markdown-body`}>
                    {msg.role === 'assistant' && msg.reasoning && (() => {
                      const reasoningPending = isStreaming && idx === messages.length - 1;
                      return (
                        <details className="mb-4 group" open={reasoningPending || undefined}>
                          <summary className="cursor-pointer select-none inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-zinc-600 hover:text-zinc-400 transition-colors">
                            {reasoningPending ? (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" />
                                <span>Reasoning</span>
                              </>
                            ) : (
                              <span>[✓] Reasoning</span>
                            )}
                            <span className="opacity-40 group-open:rotate-180 transition-transform">▼</span>
                          </summary>
                          <div className="mt-2 pl-3 border-l border-zinc-800/50 font-mono text-[11px] leading-relaxed text-zinc-500/80 whitespace-pre-wrap">
                            {msg.reasoning}
                          </div>
                        </details>
                      );
                    })()}
                    <div
                      key={`${idx}-${isEditing ? 'editing' : 'view'}`}
                      data-response-body={idx}
                      ref={isEditing ? editTextareaRef : undefined}
                      contentEditable={isEditing}
                      suppressContentEditableWarning
                      onInput={isEditing ? (e) => setEditDraft(e.currentTarget.innerText) : undefined}
                      onKeyDown={isEditing ? (e) => {
                        if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void saveEdit(); }
                      } : undefined}
                      style={isEditing ? { backgroundImage: 'repeating-linear-gradient(-12deg, rgba(39, 39, 42, 0.12) 0px, rgba(39, 39, 42, 0.12) 2px, transparent 2px, transparent 9px)' } : undefined}
                      className={`transition-colors duration-150 focus:outline-none ${isEditing ? 'bg-zinc-800/25 rounded-sm whitespace-pre-wrap' : ''}`}
                    >
                    {msg.role === 'assistant' ? (
                      <>
                        <Streamdown
                        isAnimating={isStreaming && idx === messages.length - 1}
                        components={{
                          hr: () => <hr className="border-t border-zinc-800/80 my-8" />,
                          p: ({ node, ...props }: any) => <p className="mb-[1.25em] leading-[1.75] last:mb-0" {...props} />,
                          ul: ({ node, ...props }: any) => <ul className="mb-[1.25em] pl-0 list-none" {...props} />,
                          ol: ({ node, ...props }: any) => <ol className="mb-[1.25em] pl-6 list-decimal" {...props} />,
                          li: ({ node, ...props }: any) => <li className="mb-1.5" {...props} />,
                          strong: ({ node, children, ...props }: any) => {
                            const inQuote = rpMode && isTextInDialogue(msg.content, node, children);
                            return (
                              <strong
                                {...props}
                                style={rpMode ? { color: inQuote ? '#fff' : 'rgb(161 161 170 / 0.92)' } : undefined}
                                className={inQuote ? 'font-semibold' : 'font-bold'}
                              >
                                {children}
                              </strong>
                            );
                          },
                          em: ({ node, children, ...props }: any) => {
                            const inQuote = rpMode && isTextInDialogue(msg.content, node, children);
                            return <span {...props} className={rpMode ? (inQuote ? 'text-zinc-100 italic font-normal' : 'text-zinc-500/80 italic font-normal') : 'italic font-normal'}>{children}</span>;
                          },
                          table: ({ node, ...props }: any) => (
                            <div className="w-full overflow-x-auto my-6 border border-zinc-800/80 rounded-sm">
                              <table className="w-full text-sm text-left border-collapse" {...props} />
                            </div>
                          ),
                          thead: ({ node, ...props }: any) => <thead className="bg-[#0c0c0e] border-b border-zinc-800/80 text-zinc-300" {...props} />,
                          tbody: ({ node, ...props }: any) => <tbody className="divide-y divide-zinc-800/80 text-zinc-400" {...props} />,
                          tr: ({ node, ...props }: any) => <tr className="hover:bg-zinc-900/30 transition-colors" {...props} />,
                          th: ({ node, ...props }: any) => <th className="px-4 py-3 font-medium text-zinc-200" {...props} />,
                          td: ({ node, ...props }: any) => <td className="px-4 py-3" {...props} />,
                          blockquote: ({ node, ...props }: any) => <blockquote className="border-l-2 border-zinc-600 pl-4 my-4 italic text-zinc-400" {...props} />,
                          code: ({ node, className, children, ...props }: any) => {
                            const match = /language-(\w+)/.exec(className || '');
                            const isInline = !match && !String(children).includes('\n');
                            if (isInline) {
                              return <code className="bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded-sm text-sm font-mono" {...props}>{children}</code>;
                            }

                            const CopyButton = ({ text }: { text: string }) => {
                              const [copied, setCopied] = useState(false);
                              const handleCopy = () => {
                                navigator.clipboard.writeText(text);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                              };
                              return (
                                <button
                                  onClick={handleCopy}
                                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1.5 rounded-sm text-xs border border-zinc-700/50 shadow-sm transition-all focus:outline-none focus:ring-1 focus:ring-zinc-500"
                                >
                                  {copied ? 'Copied!' : 'Copy'}
                                </button>
                              );
                            };

                            const language = match ? match[1] : 'javascript';
                            const codeString = String(children).replace(/\n$/, '');

                            return (
                              <div className="relative group mt-4 mb-6">
                                <div className="absolute top-2 right-2 opacity-60 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10">
                                  <CopyButton text={codeString} />
                                </div>
                                <div className="rounded-sm overflow-hidden border border-zinc-800/80 shadow-xl">
                                  <SyntaxHighlighter
                                    {...(props as any)}
                                    style={vscDarkPlus}
                                    language={language}
                                    PreTag="div"
                                    customStyle={{ margin: 0, background: '#0c0c0e', padding: '1rem', fontSize: '0.875rem' }}
                                  >
                                    {codeString}
                                  </SyntaxHighlighter>
                                </div>
                              </div>
                            );
                          }
                        }}
                      >{msg.content}</Streamdown>
                      </>
                    ) : msg.role === 'user' ? (
                      <Streamdown
                        isAnimating={false}
                        components={{
                          hr: () => <hr className="border-t border-zinc-800/80 my-8" />,
                          p: ({ node, ...props }: any) => <p className="mb-[1.25em] leading-[1.75] last:mb-0" {...props} />,
                          ul: ({ node, ...props }: any) => <ul className="mb-[1.25em] pl-0 list-none" {...props} />,
                          ol: ({ node, ...props }: any) => <ol className="mb-[1.25em] pl-6 list-decimal" {...props} />,
                          li: ({ node, ...props }: any) => <li className="mb-1.5" {...props} />,
                          strong: ({ node, children, ...props }: any) => {
                            const inQuote = rpMode && isTextInDialogue(msg.content, node, children);
                            return (
                              <strong {...props} style={rpMode ? { color: inQuote ? '#fff' : 'rgb(161 161 170 / 0.92)' } : undefined} className={inQuote ? 'font-semibold' : 'font-bold'}>
                                {children}
                              </strong>
                            );
                          },
                          em: ({ node, children, ...props }: any) => {
                            const inQuote = rpMode && isTextInDialogue(msg.content, node, children);
                            return <span {...props} className={rpMode ? (inQuote ? 'text-zinc-100 italic font-normal' : 'text-zinc-500/80 italic font-normal') : 'italic font-normal'}>{children}</span>;
                          },
                          a: ({ node, ...props }: any) => <a className="text-zinc-300 underline decoration-zinc-600 underline-offset-4 hover:decoration-zinc-300" {...props} />,
                          blockquote: ({ node, ...props }: any) => <blockquote className="border-l-2 border-zinc-700 pl-4 my-4 italic text-zinc-400/90" {...props} />,
                          code: ({ node, className, children, ...props }: any) => {
                            const match = /language-(\w+)/.exec(className || '');
                            const isInline = !match && !String(children).includes('\n');
                            if (isInline) return <code className="bg-zinc-800 text-zinc-200 px-1.5 py-0.5 rounded-sm text-sm font-mono" {...props}>{children}</code>;
                            const lang = match ? match[1] : 'text';
                            const str = String(children).replace(/\n$/, '');
                            return (
                              <div className="rounded-sm overflow-hidden border border-zinc-800/80 my-4">
                                <SyntaxHighlighter {...(props as any)} style={vscDarkPlus} language={lang} PreTag="div" customStyle={{ margin: 0, background: '#0c0c0e', padding: '1rem', fontSize: '0.875rem' }}>{str}</SyntaxHighlighter>
                              </div>
                            );
                          },
                        }}
                      >{msg.content}</Streamdown>
                    ) : (
                      <div className="whitespace-pre-wrap">
                        {msg.content}
                        {searchResultContent && (
                          <div className="mt-2 text-xs">
                            <details className="group">
                              <summary className="cursor-pointer select-none font-mono text-zinc-600 hover:text-zinc-400 transition-colors inline-flex items-center gap-2">
                                <span>[✓] view raw search data</span>
                                <span className="opacity-40 text-[10px] group-open:rotate-180 transition-transform">▼</span>
                              </summary>
                              <div className="mt-2 pl-3 border-l border-zinc-800/50 text-[10px] font-mono text-zinc-500/80 leading-relaxed overflow-x-auto whitespace-pre">
                                {searchResultContent}
                              </div>
                            </details>
                          </div>
                        )}
                      </div>
                    )}
                    </div>
                  </div>
                  {canEdit && idx === messages.length - 1 && !isLoading && !isStreaming && (
                    <div className={`${isEditing && editActionPosition === 'bottom' ? 'sticky bottom-0 z-30' : ''} flex items-center justify-end gap-1 min-h-[31px] pt-1 border-t border-zinc-900/70`}>
                      {isEditing && editActionPosition === 'bottom' ? (
                        <span className="inline-flex items-center gap-1 bg-[#09090b]/35 backdrop-blur-md rounded-sm">
                          <button onClick={(e) => { e.stopPropagation(); cancelEdit(); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded-sm">Cancel</button>
                          <button onClick={(e) => { e.stopPropagation(); void saveEdit(); }} disabled={!editDraft.trim()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-100 text-zinc-900 hover:bg-white disabled:opacity-40 rounded-sm">Save</button>
                        </span>
                      ) : !isEditing ? (
                      <>
                      {msg.role === 'user' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); void handleGenerateForUser(idx); }}
                          className="p-1.5 text-zinc-600 hover:text-zinc-300 rounded-sm"
                          aria-label="Generate response"
                          title="Generate response"
                        >
                          <RotateCw size={14} />
                        </button>
                      )}
                      {msg.alternatives && msg.alternatives.length > 1 && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); cycleAlternative(idx, -1); }} className="p-1 text-zinc-600 hover:text-zinc-300 rounded-sm" aria-label="Previous response" title="Previous response"><ChevronLeft size={14} /></button>
                          <span className="px-1 text-[9px] font-mono text-zinc-600">{(msg.activeAlternative ?? 0) + 1}/{msg.alternatives.length}</span>
                          <button onClick={(e) => { e.stopPropagation(); cycleAlternative(idx, 1); }} className="p-1 text-zinc-600 hover:text-zinc-300 rounded-sm" aria-label="Next response" title="Next response"><ChevronRight size={14} /></button>
                        </>
                      )}
                      {msg.role === 'assistant' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRegenerate(idx); }}
                          className="p-1.5 text-zinc-600 hover:text-zinc-300 rounded-sm"
                          aria-label="Regenerate"
                          title="Regenerate"
                        >
                          <RotateCw size={14} />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(idx, 'bottom'); }}
                        className="p-1.5 text-zinc-600 hover:text-zinc-300 rounded-sm"
                        aria-label="Edit message"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      {pendingDeleteIdx === idx ? (
                        <span data-pending-delete={idx} className="relative inline-flex items-center">
                          <span className="absolute right-full mr-1 whitespace-nowrap bg-transparent backdrop-blur-md px-1 py-0.5 rounded-sm text-[10px] font-mono lowercase text-zinc-400">are you sure?</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteMessage(idx); setPendingDeleteIdx(null); }}
                            className="p-1.5 text-red-300 bg-red-500/20 rounded-sm"
                            aria-label="Confirm delete"
                            title="Confirm delete"
                          ><X size={16} /></button>
                        </span>
                      ) : (
                        <button
                          data-delete-trigger={idx}
                          onClick={(e) => { e.stopPropagation(); setPendingDeleteIdx(idx); }}
                          className="p-1.5 text-zinc-600 hover:text-red-400 rounded-sm"
                          aria-label="Delete message"
                          title="Delete"
                        >
                          <X size={16} />
                        </button>
                      )}
                      </>) : null}
                    </div>
                  )}
                </motion.div>
              )})}

              {isLoading && (
                <motion.div 
                  initial={{ opacity: 0, filter: 'blur(4px)', y: 15 }} 
                  animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                  className="w-full flex flex-col gap-2"
                >
                  <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider">Hermes_System</span>
                  <div className="text-zinc-100 py-1">
                    <motion.div 
                      animate={{ opacity: [0, 1, 0] }} 
                      transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }} 
                      className="w-2.5 h-[1.1rem] bg-white/80" 
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} className="h-8 shrink-0 pb-8" />
          </div>
        )}

        <motion.div 
          layout 
          className={`shrink-0 z-20 pt-12 w-full pointer-events-none ${messages.length === 0 ? 'flex-1 flex flex-col justify-center pb-8' : 'absolute bottom-0 left-0 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-[#09090b] via-[#09090b] to-transparent'}`}
          transition={{ type: "spring", stiffness: 700, damping: 40 }}
        >
          <AnimatePresence>
            {messages.length === 0 && (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10, filter: 'blur(4px)', transition: { duration: 0.1, ease: "easeOut" } }} 
                className="mb-12 flex flex-col items-center pointer-events-none text-center"
              >
                <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-sm flex items-center justify-center shadow-2xl mb-6">
                   <Terminal size={20} className="text-zinc-600" />
                </div>
                <h1 className="text-lg sm:text-xl font-light text-zinc-100 tracking-tight text-center max-w-lg">
                  {greeting}
                </h1>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.form layout onSubmit={handleSubmit} className="relative group w-full flex items-center pointer-events-auto">
            <AnimatePresence>
              {showCmdPalette && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
                  className="absolute bottom-full mb-2 left-0 right-0 bg-[#0c0c0e] border border-zinc-800 rounded-sm shadow-2xl overflow-hidden z-20 max-h-48 overflow-y-auto hide-scrollbar"
                >
                  {filteredCmds.map((cmd, i) => (
                    <button
                      key={cmd.name}
                      type="button"
                      onMouseEnter={() => setCmdIndex(i)}
                      onClick={() => executeCommand(cmd.name)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors ${i === cmdIndex ? 'bg-zinc-800/60 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/30 hover:text-zinc-200'}`}
                    >
                      <span className="font-mono text-xs font-medium">{cmd.name}</span>
                      <span className="text-[11px] text-zinc-500 truncate">{cmd.desc}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {showRpRing && (
                <motion.span
                  key="rp-ring"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.6, ease: 'easeOut' } }}
                  exit={{ opacity: 0, transition: { duration: 1, ease: 'easeInOut' } }}
                  aria-hidden
                  className="rp-ring pointer-events-none absolute inset-0 z-10"
                />
              )}
            </AnimatePresence>
            <textarea
              id="chat-input"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Transmit message..."
              className="w-full bg-zinc-900/40 backdrop-blur-md hover:bg-zinc-900/60 focus:bg-zinc-900/80 border border-zinc-800/80 focus:border-zinc-700/80 rounded-sm p-4 pr-12 focus:outline-none focus:ring-0 text-[15px] sm:text-base text-zinc-100 placeholder:text-zinc-600 resize-none transition-all duration-150 overflow-hidden shadow-xl shadow-black/20 hide-scrollbar"
              rows={1}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center pointer-events-none">
              {isLoading || isStreaming ? (
                <button
                  type="button"
                  onClick={stopGeneration}
                  className="p-2 text-zinc-500 pointer-events-auto hover:text-zinc-200 transition-colors bg-transparent rounded-sm"
                  aria-label="Stop generating"
                >
                  <Square size={14} strokeWidth={2} className="fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="p-2 text-zinc-500 pointer-events-auto hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-500 transition-colors bg-transparent rounded-sm"
                  aria-label="Send message"
                >
                  <Send size={18} strokeWidth={2} className="-ml-0.5 mt-0.5" />
                </button>
              )}
            </div>
          </motion.form>
        </motion.div>
      </main>
    </motion.div>
  );
}
