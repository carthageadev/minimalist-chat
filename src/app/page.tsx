import SilkShader from "@/components/ui/silk-shader";
import { MorphPanel as AIInput } from "@/components/ui/ai-input";

export default function Home() {
  return (
    <main className="relative w-full h-screen overflow-hidden bg-black flex items-center justify-center">
      {/* Background Silk Shader */}
      <SilkShader className="absolute inset-0 z-0" />

      {/* Foreground Content */}
      <div className="relative z-10">
        <AIInput />
      </div>
    </main>
  );
}
