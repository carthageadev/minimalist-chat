import SilkShader from "@/components/ui/silk-shader";
import { Component as Bloodline } from "@/components/ui/bloodline";

export default function Home() {
  return (
    <main className="relative w-full h-screen overflow-hidden bg-black">
      {/* Background Silk Shader */}
      <SilkShader className="absolute inset-0 z-0" />

      {/* Foreground Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full">
        <Bloodline />
        <div className="mt-8 text-center text-white/40 pointer-events-none">
          <p className="text-sm font-light tracking-widest uppercase mb-2">Ahmed Ben Abdallah</p>
          <h1 className="text-4xl font-extralight tracking-tighter">New Silk Shader Experience</h1>
        </div>
      </div>
    </main>
  );
}
