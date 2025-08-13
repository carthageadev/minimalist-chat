"use client";

import Character from "~/components/Character";

export default function FbxPage() {
  return (
    <div className="w-[100vw] h-[100vh]">
      <Character modelPath="/animations/dancing.fbx" />
    </div>
  );
}
