"use client";

import CharacterV2 from "~/components/CharacterV2";
import { RetroChat } from "~/components/retro-chat/retro-chat";

export default function FbxPage() {
  return (
    <div className="w-[100vw] h-[100vh] bg-black overflow-hidden">
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
    </div>
  );
}
