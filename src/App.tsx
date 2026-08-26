import React, { useState, useRef, useEffect } from 'react';
import { Send, Lock, Terminal, Maximize, Minimize, X, Square, Check, Brain, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'motion/react';

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

const MODELS = [
  { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', label: 'Nemotron 3 Nano' },
  { id: 'poolside/laguna-xs-2.1', label: 'Laguna XS 2.1' },
  { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B' },
  { id: 'minimaxai/minimax-m3', label: 'MiniMax M3' },
];

interface Message {
  role: Role;
  content: string;
  reasoning?: string;
  error?: boolean;
}

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

export default function App() {
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [model, setModel] = useState<string>(() => localStorage.getItem('selected-model') || MODELS[0].id);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [lagunaThinking, setLagunaThinking] = useState<boolean>(() => localStorage.getItem('laguna-thinking') !== '0');
  const [rpMode, setRpMode] = useState<boolean>(false);
  const [rpReveal, setRpReveal] = useState<boolean>(false);

  useEffect(() => {
    if (!rpMode) return;
    setRpReveal(true);
    const t = setTimeout(() => setRpReveal(false), 5000);
    return () => clearTimeout(t);
  }, [rpMode]);

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
        const resp = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            thinking: false,
            isPersona: true,
            messages: [
              { role: 'system', content: PERSONA_SYSTEM_PROMPTS[kind] },
              {
                role: 'user',
                content: current
                  ? `Here is my rough idea. Expand and elevate it into the full description — keep my core idea but make it richer and more original:\n\n${current}`
                  : `Create a completely fresh, unique concept entirely of your own choosing. Be random, surprising and original — avoid clichés and anything predictable.`,
              },
            ],
          }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const reader = resp.body?.getReader();
        if (!reader) throw new Error('No reader');
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (controller.signal.aborted) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') continue;
              try {
                const data = JSON.parse(dataStr);
                if (data.error) throw new Error(data.error);
                if (data.content) pendingOut += data.content;
              } catch {}
            }
          }
        }
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

  const toggleLagunaThinking = () => {
    setLagunaThinking((v) => {
      const next = !v;
      localStorage.setItem('laguna-thinking', next ? '1' : '0');
      return next;
    });
  };

  const selectedLabel = MODELS.find((m) => m.id === model)?.label ?? model;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

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

  const processChat = async (currentMessages: Message[]) => {
    // Interrupt any in-flight stream before starting a new one
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setIsStreaming(false);
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentMessages,
          model,
          rp: rpMode,
          ...(rpMode ? { userPersona, charPersona } : {}),
          ...(rpMode && promptIsCustom && systemPrompt.trim() ? { customSystemPrompt: systemPrompt } : {}),
          ...(model.startsWith('poolside/') ? { thinking: lagunaThinking } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try {
          const j = await response.json();
          const detail = j?.error || (typeof j?.detail === 'string' ? j.detail : null);
          if (detail) errMsg = `${response.status} — ${detail}`;
        } catch (e) {}
        throw new Error(errMsg);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');
      
      const decoder = new TextDecoder();
      let startedStreaming = false;
      let buffer = '';
      let fullAssistantMessage = '';

      while (true) {
        const { value, done } = await reader.read();
        
        if (!startedStreaming) {
          startedStreaming = true;
          setIsLoading(false);
          setIsStreaming(true);
          setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
        }

        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        let chunkContent = '';
        let chunkReasoning = '';
        let streamError: string | null = null;

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.error) { streamError = data.error; break; }
              if (data.reasoning) {
                chunkReasoning += data.reasoning;
              }
              if (data.content) {
                chunkContent += data.content;
                fullAssistantMessage += data.content;
              }
            } catch (e) {
              // Ignore partial JSON
            }
          }
        }

        if (streamError) throw new Error(streamError);

        if (chunkContent || chunkReasoning) {
          setMessages((prev) => {
            const prevMessages = [...prev];
            const lastIndex = prevMessages.length - 1;
            const last = prevMessages[lastIndex];
            if (last && last.role === 'assistant') {
              prevMessages[lastIndex] = {
                ...last,
                content: last.content + chunkContent,
                reasoning: (last.reasoning || '') + chunkReasoning,
              };
            }
            return prevMessages;
          });
        }
      }

      const searchMatch = fullAssistantMessage.match(/\[SEARCH:\s*(.*?)\]/i);
      
      if (searchMatch) {
        const query = searchMatch[1];
        setMessages((prev) => [...prev, { role: 'system', content: `[SEARCH] Executing search for: "${query}"...` }]);
        
        const searchResults = await searchDDGVAPI(query);
        if (controller.signal.aborted) return;
        
        const searchResultMessage: Message = {
          role: 'user', 
          content: `[SEARCH RESULTS for "${query}"]\n\n${searchResults}\n\nNow, answer my original query using this information.` 
        };
        
        const newMessagesToSend = trimHistory([
          ...currentMessages,
          { role: 'assistant', content: fullAssistantMessage } as Message,
          searchResultMessage,
        ]);

        setMessages((prev) => [
          ...prev, 
          { role: 'system', content: `[SEARCH] Retrieved results for: "${query}"` },
          searchResultMessage
        ]);

        await processChat(newMessagesToSend);
        return;
      }

    } catch (error: any) {
      if (error?.name === 'AbortError') {
        // Interrupted by user — keep partial response, no error message
        return;
      }
      console.error('Failed to send message:', error);
      setMessages((prev) => [...prev, { role: 'assistant', content: `Transmission error — ${error?.message || 'unknown failure'}`, error: true }]);
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

    // If a response is in flight, interrupt it before sending the new message
    if (isLoading || isStreaming) {
      abortControllerRef.current?.abort();
    }

    const userMessage: Message = { role: 'user', content: input.trim() };
    const newMessages = trimHistory([...messages, userMessage]);
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setIsStreaming(false);
    
    // Reset textarea height after sending
    const textarea = document.getElementById('chat-input') as HTMLTextAreaElement;
    if (textarea) {
      textarea.style.height = 'auto';
    }

    await processChat(newMessages);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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
            className="flex items-center gap-2 hover:text-zinc-300 transition-colors focus:outline-none"
          >
            <Lock size={12} className="text-zinc-600" />
            <span>{rpMode ? 'Setup' : 'E2E Channel'}</span>
          </button>
          
          <button
            onClick={toggleFullscreen}
            className="p-1.5 hover:text-zinc-300 transition-colors focus:outline-none text-zinc-600 hover:bg-zinc-800/50 rounded-sm"
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize size={12} /> : <Maximize size={12} />}
          </button>
        </div>
        
        <div className="relative flex items-center">
          <button
            onClick={() => setShowModelPicker((v) => !v)}
            className={`flex items-center gap-2 transition-colors focus:outline-none ${showModelPicker ? 'text-zinc-300' : 'hover:text-zinc-300'}`}
          >
            <span>{selectedLabel}</span>
            <Terminal size={12} className="text-zinc-600" />
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
                  className="absolute right-0 top-full mt-3 z-30 w-56 bg-[#0c0c0e] border border-zinc-800 rounded-sm shadow-2xl py-1.5 normal-case tracking-normal"
                >
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={m.id.startsWith('poolside/') ? handleLagunaClick : () => selectModel(m.id)}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-2 text-left font-mono text-[11px] transition-colors focus:outline-none ${m.id === model ? 'text-zinc-100 bg-zinc-800/40' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/30'}`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{m.label}</span>
                        {m.id.startsWith('poolside/') && (
                          <motion.span
                            role="switch"
                            aria-checked={lagunaThinking}
                            aria-label="Toggle thinking"
                            title={lagunaThinking ? 'Thinking: on' : 'Thinking: off'}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLagunaThinking();
                            }}
                            whileTap={{ scale: 0.7, rotate: -8 }}
                            animate={{ scale: [1, 1.25, 1] }}
                            key={String(lagunaThinking)}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                            className={`cursor-pointer shrink-0 transition-colors duration-200 ${lagunaThinking ? 'text-zinc-100' : 'text-zinc-600 hover:text-zinc-400'}`}
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
          <div className="absolute inset-x-0 inset-y-0 overflow-y-auto hide-scrollbar scroll-smooth pt-[calc(7rem+env(safe-area-inset-top))] pb-48 px-6 space-y-12">
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

                return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.1, ease: "easeOut" }}
                  className="w-full flex flex-col gap-2"
                >
                  <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-wider">
                    {msg.role === 'user' ? 'Session_User' : msg.role === 'system' ? 'System_Log' : 'Hermes_System'}
                  </span>
                  <div className={`text-[15px] sm:text-base leading-relaxed ${msg.role === 'user' ? 'text-zinc-400' : msg.role === 'system' ? 'text-blue-400/80' : msg.error ? 'text-red-400/80' : 'text-zinc-100'} markdown-body`}>
                    {msg.role === 'assistant' ? (
                      <>
                        {msg.reasoning && (() => {
                          const reasoningPending = isStreaming && idx === messages.length - 1;
                          return (
                            <details className="mb-4 group" open={reasoningPending || undefined}>
                              <summary className="cursor-pointer select-none inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-zinc-600 hover:text-zinc-400 transition-colors">
                                {reasoningPending ? (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
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
                        <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          hr: () => <hr className="border-t border-zinc-800/80 my-8" />,
                          strong: ({ node, children, ...props }) => {
                            const start = node?.position?.start?.offset ?? -1;
                            const before = start >= 0 ? msg.content.slice(0, start) : '';
                            const inQuote = (before.match(/"/g) || []).length % 2 === 1;
                            return (
                              <strong
                                style={{ color: inQuote ? '#fff' : 'rgb(161 161 170 / 0.92)' }}
                                className={inQuote ? 'font-semibold' : 'font-bold'}
                                {...props}
                              >
                                {children}
                              </strong>
                            );
                          },
                          em: ({ node, children, ...props }) => {
                            const start = node?.position?.start?.offset ?? -1;
                            const before = start >= 0 ? msg.content.slice(0, start) : '';
                            const inQuote = (before.match(/"/g) || []).length % 2 === 1;
                            return <span className={inQuote ? 'text-zinc-100 italic font-medium' : 'text-zinc-500/80'} {...props}>{children}</span>;
                          },
                          table: ({ node, ...props }) => (
                            <div className="w-full overflow-x-auto my-6 border border-zinc-800/80 rounded-sm">
                              <table className="w-full text-sm text-left border-collapse" {...props} />
                            </div>
                          ),
                          thead: ({ node, ...props }) => <thead className="bg-[#0c0c0e] border-b border-zinc-800/80 text-zinc-300" {...props} />,
                          tbody: ({ node, ...props }) => <tbody className="divide-y divide-zinc-800/80 text-zinc-400" {...props} />,
                          tr: ({ node, ...props }) => <tr className="hover:bg-zinc-900/30 transition-colors" {...props} />,
                          th: ({ node, ...props }) => <th className="px-4 py-3 font-medium text-zinc-200" {...props} />,
                          td: ({ node, ...props }) => <td className="px-4 py-3" {...props} />,
                          blockquote: ({ node, ...props }) => <blockquote className="border-l-2 border-zinc-600 pl-4 my-4 italic text-zinc-400" {...props} />,
                          code: ({ node, className, children, ...props }) => {
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
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
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
                      >{msg.content}</ReactMarkdown>
                      </>
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
