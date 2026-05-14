"use client";

import { InputBar } from "@/components/ui/input-bar";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import OpenAI from "openai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check } from "lucide-react";

// Initialize the Hermes AI client

const client = new OpenAI({
  baseURL: "https://hermes.ai.unturf.com/v1",
  apiKey: "dummy-api-key",
  dangerouslyAllowBrowser: true, // Required for client-side API calls
});

const MODEL = "adamo1139/Hermes-3-Llama-3.1-8B-FP8-Dynamic";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
      title="Copy code"
    >
      {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
    </button>
  );
};

export default function Home() {

  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<"ready" | "streaming" | "submitted" | "idle">("ready");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (msg: { role: "user"; content: string }) => {
    if (!msg.content.trim()) return;

    // Add user message
    const newMessages: Message[] = [...messages, { role: "user", content: msg.content }];
    setMessages(newMessages);
    setStatus("submitted");

    try {
      setStatus("streaming");
      
      const response = await client.chat.completions.create({
        model: MODEL,
        messages: newMessages,
        temperature: 0.5,
        max_tokens: 500,
      });

      const assistantContent = response.choices[0].message.content || "No response received.";
      
      setMessages((prev) => [...prev, { role: "assistant", content: assistantContent }]);
      setStatus("ready");
    } catch (error) {
      console.error("AI Error:", error);
      setMessages((prev) => [...prev, { role: "assistant", content: "Error connecting to Hermes AI. Please check the console." }]);
      setStatus("ready");
    }
  };

  return (
    <main className="relative flex flex-col w-full h-screen bg-[#050505] text-white font-sans overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6 border-b border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="text-sm font-medium tracking-widest uppercase text-zinc-400">Hermes Protocol</h1>
        </div>
        <div className="text-[10px] text-zinc-600 font-mono tracking-tighter">
          v1.0.4 // LOCALHOST
        </div>
      </header>

      {/* Chat History */}
      <div 
        ref={scrollRef}
        className="relative z-10 flex-1 overflow-y-auto px-4 py-8 scroll-smooth"
      >
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
          {messages.length === 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="w-12 h-12 mb-6 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center">
                <span className="text-emerald-500 text-xl font-bold">H</span>
              </div>
              <h2 className="text-2xl font-semibold mb-2">Initialize Communication</h2>
              <p className="text-zinc-500 text-sm max-w-xs">
                Hermes-3 is ready for your input. Secure connection established.
              </p>
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div 
                  className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    m.role === "user" 
                      ? "bg-zinc-100 text-black font-medium rounded-tr-none" 
                      : "bg-zinc-900 border border-white/5 text-zinc-200 rounded-tl-none shadow-2xl"
                  }`}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={{
                      code({ node, inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || "");
                        return !inline && match ? (
                          <div className="my-4 rounded-lg overflow-hidden border border-white/10 shadow-inner bg-[#0d0d0d]">
                            <div className="flex items-center justify-between px-4 py-2 bg-zinc-800/50 border-b border-white/5">
                              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">{match[1]}</span>
                              <CopyButton text={String(children).replace(/\n$/, "")} />
                            </div>
                            <SyntaxHighlighter

                              style={vscDarkPlus}
                              language={match[1]}
                              PreTag="div"
                              className="!m-0 !bg-transparent !p-4"
                              {...props}
                            >
                              {String(children).replace(/\n$/, "")}
                            </SyntaxHighlighter>
                          </div>
                        ) : (
                          <code className="bg-white/10 px-1.5 py-0.5 rounded-md font-mono text-xs text-emerald-400" {...props}>
                            {children}
                          </code>
                        );
                      },
                      p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="text-zinc-300">{children}</li>,
                      h1: ({ children }) => <h1 className="text-xl font-bold mb-4 mt-2 text-white">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-bold mb-3 mt-2 text-white">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-2 text-white">{children}</h3>,
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-emerald-500/50 pl-4 py-1 italic text-zinc-400 my-4 bg-emerald-500/5 rounded-r-lg">
                          {children}
                        </blockquote>
                      ),
                      a: ({ children, href }) => (
                        <a href={href} className="text-emerald-400 hover:underline transition-all" target="_blank" rel="noopener noreferrer">
                          {children}
                        </a>
                      ),
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-4 rounded-lg border border-white/10">
                          <table className="w-full text-left border-collapse">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => <thead className="bg-white/5 text-zinc-400 text-xs uppercase">{children}</thead>,
                      th: ({ children }) => <th className="px-4 py-2 font-semibold">{children}</th>,
                      td: ({ children }) => <td className="px-4 py-2 border-t border-white/5 text-zinc-300">{children}</td>,
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {status === "streaming" && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="px-4 py-3 rounded-2xl bg-zinc-900 border border-white/5 text-zinc-500 text-xs italic animate-pulse">
                Processing signal...
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Input Section */}
      <footer className="relative z-20 pb-8 pt-4 backdrop-gradient-to-t from-black via-black/80 to-transparent">
        <div className="max-w-xl mx-auto">
          <InputBar 
            status={status}
            onSend={handleSend}
            placeholder="Relay a message to Hermes..."
          />
          <p className="text-[10px] text-center mt-3 text-zinc-600 uppercase tracking-widest">
            Encryption Active // End-to-End Secure
          </p>
        </div>
      </footer>
    </main>
  );
}
