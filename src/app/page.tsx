"use client";

import React from "react";
import CharacterV2 from "~/components/CharacterV2";
import { RetroChat } from "~/components/retro-chat/retro-chat";

export default function Home() {
  return (
    <div className="w-[100vw] h-[100vh]">
      <div
        className="w-[450px] h-[600px] absolute top-24 right-14 z-10"
        style={{
          fontFamily: `'Courier New', Courier, monospace`,
        }}
      >
        <RetroChat />
      </div>

      <CharacterV2 />
    </div>
  );
}
