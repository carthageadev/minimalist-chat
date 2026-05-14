"use client";

import { InputBar } from "@/components/ui/input-bar";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import OpenAI from "openai";
import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import "streamdown/styles.css";

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
      
      const stream = await client.chat.completions.create({
        model: MODEL,
        messages: newMessages,
        temperature: 0.5,
        max_tokens: 500,
        stream: true,
      });

      let assistantContent = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) {
          assistantContent += text;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            return [...prev.slice(0, -1), { ...last, content: assistantContent }];
          });
        }
      }

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
                  <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent prose-code:text-emerald-400 prose-code:before:content-none prose-code:after:content-none">
                    <Streamdown
                      animated
                      plugins={{ code }}
                      isAnimating={status === "streaming" && i === messages.length - 1}
                    >
                      {m.content}
                    </Streamdown>
                  </div>

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
