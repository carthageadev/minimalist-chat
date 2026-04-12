import SilkShader from "@/components/ui/silk-shader";

export default function Home() {
  return (
    <main className="relative w-full h-screen overflow-hidden bg-black">
      {/* Background Silk Shader ONLY */}
      <SilkShader className="absolute inset-0 z-0" />
    </main>
  );
}
