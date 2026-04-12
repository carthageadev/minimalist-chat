'use client';

import { cn } from "@/lib/utils";
import { useState } from "react";

export const Component = () => {
  const [count, setCount] = useState(0);

  return (
    <div className={cn("flex flex-col items-center gap-4 p-4 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 text-white")}>
      <h1 className="text-2xl font-bold mb-2">Component Example</h1>
      <h2 className="text-xl font-semibold">{count}</h2>
      <div className="flex gap-4">
        <button 
          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md transition-colors"
          onClick={() => setCount((prev) => prev - 1)}
        >
          -
        </button>
        <button 
          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md transition-colors"
          onClick={() => setCount((prev) => prev + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
};
