import { IconArrowRight, IconPlayerRecordFilled } from "@tabler/icons-react";
import Noise from "../noise/noise";
import TargetCursor from "../target-cursor/target-cursor";
import { api } from "~/trpc/react";
import { useState, useRef, useEffect } from "react";
import FuzzyText from "../fuzzy-text/fuzzy-text";
import { dispatchLightEvent, type LightAction } from "~/lib/light-events";

export const RetroChat = () => {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const forcedAutoScrollRef = useRef(false);
  const [chatWidth, setChatWidth] = useState<number>(406);

  const [messages, setMessages] = useState<string[]>([]);

  const [history, setHistory] = useState<
    {
      role: "user" | "model";
      parts: { text: string }[];
    }[]
  >([]);

  const [query, setQuery] = useState<{
    message: string;
    trackId: string | null;
  }>(
    {
      message: "",
      trackId: null,
    }
  );

  const typingIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        window.clearInterval(typingIntervalRef.current);
      }
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
      }
    };
  }, []);

  // Auto-scroll to bottom when messages change. If forcedAutoScrollRef is true (LLM typing)
  // we keep auto-scrolling regardless of user's scroll position until typing finishes.
  const scrollAnimationRef = useRef<number | null>(null);
  const lastScrollHeightRef = useRef<number>(0);
  
  const scrollToBottom = (smooth = true) => {
    const el = chatContainerRef.current;
    if (!el) return;
    
    const targetHeight = el.scrollHeight;
    const currentScroll = el.scrollTop;
    const clientHeight = el.clientHeight;
    const targetScroll = targetHeight - clientHeight;
    
    // If already at bottom or very close, don't animate
    if (Math.abs(currentScroll - targetScroll) < 2) return;
    
    if (scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current);
    }
    
    if (!smooth) {
      el.scrollTop = targetScroll;
      return;
    }
    
    // Ultra smooth scroll with easing
    const startScroll = currentScroll;
    const distance = targetScroll - startScroll;
    const startTime = performance.now();
    const duration = Math.min(300, Math.abs(distance) * 0.5); // Adaptive duration
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic for ultra smooth feel
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const newScroll = startScroll + (distance * easeOut);
      
      el.scrollTop = newScroll;
      
      if (progress < 1) {
        scrollAnimationRef.current = requestAnimationFrame(animate);
      } else {
        scrollAnimationRef.current = null;
      }
    };
    
    scrollAnimationRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    // Don't use useEffect auto-scroll when forced mode is active - 
    // the typing interval handles scrolling directly for smoother experience
    if (forcedAutoScrollRef.current) return;

    if (!shouldAutoScrollRef.current) return; // user scrolled up, don't auto-scroll

    const timeoutId = setTimeout(() => scrollToBottom(true), 10);
    return () => clearTimeout(timeoutId);
  }, [history, messages]);

  // Update auto-scroll flag based on user's scroll position
  const handleChatScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    // while forced auto-scroll is active, ignore user scroll inputs
    if (forcedAutoScrollRef.current) return;
    
    const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    // Use a larger threshold and debounce to prevent jitter
    shouldAutoScrollRef.current = distanceFromBottom < 100;
    shouldAutoScrollRef.current = distanceFromBottom < 80;
  };

  // Measure chat column width and update on resize so FuzzyText can wrap correctly on mobile
  useEffect(() => {
    const measure = () => {
      const el = chatContainerRef.current;
      if (!el) return;
      // subtract padding to get inner text area width
      const width = Math.max(100, el.clientWidth - 16);
      setChatWidth(width);
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const sendMessageMutation = api.chat.sendMessage.useMutation({
    onMutate: () => {
      setIsLoading(true);
      // Keep input focused immediately when starting mutation
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    onSuccess: (response) => {
      const fullText = response || "No response";

      // Append user's turn and an empty model turn we will fill while typing
      setHistory((prev) => [
        ...prev,
        { role: "user" as const, parts: [{ text: message }] },
        { role: "model" as const, parts: [{ text: "" }] },
      ]);

  // Animate text into the last history entry
  let idx = 0;
  // Force auto-scroll while the model is typing
  forcedAutoScrollRef.current = true;
      const chunk = 2; // characters per tick
      const tickMs = 24; // ~40fps

      if (typingIntervalRef.current) {
        window.clearInterval(typingIntervalRef.current);
      }

      typingIntervalRef.current = window.setInterval(() => {
        idx = Math.min(fullText.length, idx + chunk);
        setHistory((prev) => {
          if (prev.length === 0) return prev;
          const copy = prev.slice();
          const prevLast = copy[copy.length - 1];
          const last = {
            role: prevLast?.role ?? "model",
            parts: [{ text: fullText.slice(0, idx) }],
          } as { role: "user" | "model"; parts: { text: string }[] };
          copy[copy.length - 1] = last;
          return copy;
        });

        // Only scroll if content height actually changed (prevents jitter)
        if (forcedAutoScrollRef.current) {
          const el = chatContainerRef.current;
          if (el && el.scrollHeight !== lastScrollHeightRef.current) {
            lastScrollHeightRef.current = el.scrollHeight;
            scrollToBottom(true);
          }
        }

        if (idx >= fullText.length) {
          if (typingIntervalRef.current) {
            window.clearInterval(typingIntervalRef.current);
            typingIntervalRef.current = null;
          }
          // Release forced auto-scroll when typing is finished
          forcedAutoScrollRef.current = false;
        }
      }, tickMs);
    },
    onSettled: () => {
      setIsLoading(false);
      setMessage("");
      // Ensure input stays focused after everything is done
      setTimeout(() => inputRef.current?.focus(), 0);
    },
  });

  return (
    <div className="w-full h-full p-2 sm:p-4 md:p-6 flex items-start justify-center overflow-x-hidden">
      <div className="w-full max-w-4xl h-full border-2 border-green-700 bg-green-950/70 relative overflow-hidden">
        <TargetCursor spinDuration={7} />
        <div className="relative w-full h-[calc(100%-64px)] overflow-hidden">
          <Noise patternAlpha={25} />

          <div
            ref={chatContainerRef}
            onScroll={handleChatScroll}
            className={
              "w-full h-full p-4 text-green-600 retro-text overflow-y-auto overflow-x-hidden scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style]:none [scrollbar-width]:none"
            }
        >
          {history.map((message, index) => (
            <p
              key={message.parts[0]?.text ?? index}
              className="cursor-target mb-2"
            >
              <FuzzyText baseIntensity={0.008} enableHover={false} containerWidth={chatWidth}>
                {message.role}: {message.parts[0]!.text}
              </FuzzyText>
            </p>
          ))}
          <FuzzyText baseIntensity={0.008} enableHover={false} containerWidth={chatWidth}>
            {messages.length > 0 && "model: "}
            {messages}
          </FuzzyText>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessageMutation.mutate({ message, history });
          // refocus immediately so the input doesn't lose focus when submitting
          inputRef.current?.focus();
        }}
        className="w-full h-[64px] border-t-2 border-green-700 flex gap-2 overflow-x-hidden min-w-0"
      >
        <input
          type="text"
          disabled={isLoading}
          placeholder={isLoading ? "Please wait..." : "Message..."}
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          autoFocus
          className="text-2xl text-green-600 w-full h-full px-3 bg-transparent border-none outline-none border-r-2 border-green-700 relative cursor-target min-w-0 flex-1"
        />
        <button
          disabled={isLoading}
          className="bg-green-700 text-white px-3 py-2 w-[64px] cursor-target flex items-center justify-center"
        >
          {isLoading ? (
            <IconPlayerRecordFilled color="#006400" className="animate-pulse" />
          ) : (
            <IconArrowRight />
          )}
        </button>
      </form>
      </div>
    </div>
  );
};
