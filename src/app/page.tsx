import SilkShader from "@/components/ui/silk-shader";
import { MorphPanel as AIInput } from "@/components/ui/ai-input";

export default function Home() {
  return (
    <main className="relative w-full h-screen overflow-hidden bg-black flex items-center justify-center">
      {/* Background Silk Shader */}
      <SilkShader className="absolute inset-0 z-0" />

      {/* Foreground Content */}
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="mb-12 text-center pointer-events-none">
          <p className="text-xs font-light tracking-[0.3em] uppercase text-white/30 mb-3 animate-pulse">
            Ahmed Ben Abdallah
          </p>
          <h1 className="text-3xl font-extralight tracking-tighter text-white/60">
            Digital Fabric AI
          </h1>
        </div>
        
        <div className="flex justify-center">
          <AIInput />
        </div>
      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-8 left-0 right-0 text-center pointer-events-none">
        <span className="text-[10px] font-light tracking-widest uppercase text-white/10">
          Built with Bun & Next.js
        </span>
      </div>
    </main>
  );
}
