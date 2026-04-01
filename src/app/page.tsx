"use client";

import { useState, useEffect } from "react";
import TerminalBoot from "~/components/TerminalBoot";
import GlitchEffects from "~/components/GlitchEffects";
import { RetroChat } from "~/components/retro-chat/retro-chat";
import CRTTerminal from "~/components/retro-demos/CRTTerminal";
import LCDGadget from "~/components/retro-demos/LCDGadget";

type AppMode = "init" | "chat" | "glitch" | "crt" | "lcd";

export default function Home() {
  const [mode, setMode] = useState<AppMode>("init");
  const [isBooted, setIsBooted] = useState(false);

  useEffect(() => {
    // Forced chat mode for testing
    const modes: AppMode[] = ["chat"];
    const randomMode = "chat";

    // Debug: override with URL params for testing ?mode=crt
    const urlParams = new URLSearchParams(window.location.search);
    const modeParam = urlParams.get("mode") as AppMode;

    if (modeParam && modes.includes(modeParam)) {
      setMode(modeParam);
    } else {
      setMode(randomMode);
    }
  }, []);

  if (mode === "init") return <div className="bg-black w-full h-screen" />;

  return (
    <div className="w-[100vw] h-[100vh] bg-black overflow-hidden relative">

      {/* 1. CRT MODE */}
      {mode === "crt" && <CRTTerminal />}

      {/* 2. LCD MODE */}
      {mode === "lcd" && <LCDGadget />}

      {/* 3. CHAT MODE (Normal Flow) */}
      {mode === "chat" && (
        !isBooted ? (
          <TerminalBoot onComplete={() => setIsBooted(true)} />
        ) : (
          <>
            <GlitchEffects />
            <div
              className="w-[450px] h-[600px] absolute top-24 right-14 z-10"
              style={{
                fontFamily: `'Courier New', Courier, monospace`,
              }}
            >
              <RetroChat />
            </div>
          </>
        )
      )}

      {/* 4. GLITCH LOOP MODE (Access Denied Simulation) */}
      {mode === "glitch" && (
        <TerminalBoot onComplete={() => { }} forceMode="glitch" />
      )}

    </div>
  );
}
