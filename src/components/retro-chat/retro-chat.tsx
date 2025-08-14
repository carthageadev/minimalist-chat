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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const scrollToBottom = () => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop =
          chatContainerRef.current.scrollHeight;
      }
    };

    // Add a small delay to ensure content is rendered
    const timeoutId = setTimeout(scrollToBottom, 100);

    return () => clearTimeout(timeoutId);
  }, [history, messages]);

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
        }
      }, tickMs);
    },
    onSettled: () => {
      setIsLoading(false);
      setMessage("");
    },
  });

  return (
    <div className="w-full h-full border-2 border-green-700 bg-green-950/70 relative overflow-hidden">
      <TargetCursor spinDuration={7} />
      <div className="relative w-full h-[calc(100%-64px)] overflow-hidden">
        <Noise patternAlpha={25} />

        <div
          ref={chatContainerRef}
          className={
            "w-full h-full p-4 text-green-600 retro-text overflow-y-scroll scroll-smooth [&::-webkit-scrollbar]:w-2 dark:[&::-webkit-scrollbar-thumb]:bg-green-700"
          }
        >
          {history.map((message, index) => (
            <p
              key={message.parts[0]?.text ?? index}
              className="cursor-target mb-2"
            >
              <FuzzyText baseIntensity={0.008} enableHover={false}>
                {message.role}: {message.parts[0]!.text}
              </FuzzyText>
            </p>
          ))}
          <FuzzyText baseIntensity={0.008} enableHover={false}>
            {messages.length > 0 && "model: "}
            {messages}
          </FuzzyText>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessageMutation.mutate({ message, history });
        }}
        className="w-full h-[64px] border-t-2 border-green-700 flex gap-2"
      >
        <input
          type="text"
          disabled={isLoading}
          placeholder={isLoading ? "Please wait..." : "Message..."}
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
  );
};
