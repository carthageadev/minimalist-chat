"use client";

import { useState } from "react";
import TerminalBoot from "~/components/TerminalBoot";
import GlitchEffects from "~/components/GlitchEffects";
import { RetroChat } from "~/components/retro-chat/retro-chat";

export default function Home() {
  const [isBooted, setIsBooted] = useState(false);

  return (
    <div className="w-[100vw] h-[100vh] bg-black overflow-hidden relative">
      {!isBooted ? (
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

          {/* TODO: 3D model disabled for now - will work on it later */}
          {/* <CharacterV2 /> */}
        </>
      )}
    </div>
  );
}
