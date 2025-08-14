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
    };
  }, []);

  // Auto-scroll to bottom when messages change. If forcedAutoScrollRef is true (LLM typing)
  // we keep auto-scrolling regardless of user's scroll position until typing finishes.
  const scrollToBottom = (smooth = true) => {
    const el = chatContainerRef.current;
    if (!el) return;
    try {
      el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    } catch (e) {
      el.scrollTop = el.scrollHeight;
    }
  };

  useEffect(() => {
    if (forcedAutoScrollRef.current) {
      // ensure the view follows the typing LLM smoothly
      scrollToBottom(true);
      return;
    }

    if (!shouldAutoScrollRef.current) return; // user scrolled up, don't auto-scroll

    const timeoutId = setTimeout(() => scrollToBottom(true), 50);
    return () => clearTimeout(timeoutId);
  }, [history, messages]);

  // Update auto-scroll flag based on user's scroll position
  const handleChatScroll = () => {
    const el = chatContainerRef.current;
    if (!el) return;
    // while forced auto-scroll is active, ignore user scroll inputs
    if (forcedAutoScrollRef.current) return;
    const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    // If within 80px of bottom, consider user at bottom and enable auto-scroll
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
      // keep input focused so the user can continue typing
      inputRef.current?.focus();
    },
  });

  return (
  <div className="w-full h-full flex items-center justify-center overflow-x-hidden">
      <div className="w-full max-w-3xl h-full border-2 border-green-700 bg-green-950/70 relative overflow-hidden">
      <TargetCursor spinDuration={7} />
  <div className="relative w-full h-[calc(100%-64px)] overflow-hidden">
        <Noise patternAlpha={25} />

        <div
          ref={chatContainerRef}
          onScroll={handleChatScroll}
          className={
    "w-full h-full p-4 text-green-600 retro-text overflow-y-scroll overflow-x-hidden scroll-smooth [&::-webkit-scrollbar]:w-2 dark:[&::-webkit-scrollbar-thumb]:bg-green-700"
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
        className="w-full h-[64px] border-t-2 border-green-700 flex gap-2 overflow-x-hidden"
      >
        <input
          type="text"
          disabled={isLoading}
          placeholder={isLoading ? "Please wait..." : "Message..."}
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="text-2xl text-green-600 w-full h-full px-3 bg-transparent border-none outline-none border-r-2 border-green-700 relative cursor-target"
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
