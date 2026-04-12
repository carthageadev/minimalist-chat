'use client';

import React, { useEffect, useRef } from 'react';
import { BlurFade } from '@/components/ui/blur-fade';
import { Waves } from 'lucide-react';

export const Component = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    const speed = 0.02;
    const scale = 2;
    const noiseIntensity = 0.8;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Simple noise function
    const noise = (x: number, y: number) => {
      const G = 2.71828;
      const rx = G * Math.sin(G * x);
      const ry = G * Math.sin(G * y);
      return (rx * ry * (1 + x)) % 1;
    };

    const animate = () => {
      const { width, height } = canvas;
      
      // Create gradient background
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#1a1a1a');
      gradient.addColorStop(0.5, '#2a2a2a');
      gradient.addColorStop(1, '#1a1a1a');
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Create silk-like pattern
      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;

      for (let x = 0; x < width; x += 2) {
        for (let y = 0; y < height; y += 2) {
          const u = (x / width) * scale;
          const v = (y / height) * scale;
          
          const tOffset = speed * time;
          let tex_x = u;
          let tex_y = v + 0.03 * Math.sin(8.0 * tex_x - tOffset);

          const pattern = 0.6 + 0.4 * Math.sin(
            5.0 * (tex_x + tex_y + 
              Math.cos(3.0 * tex_x + 5.0 * tex_y) + 
              0.02 * tOffset) +
            Math.sin(20.0 * (tex_x + tex_y - 0.1 * tOffset))
          );

          const rnd = noise(x, y);
          const intensity = Math.max(0, pattern - rnd / 15.0 * noiseIntensity);
          
          // Purple-gray silk color
          const r = Math.floor(123 * intensity);
          const g = Math.floor(116 * intensity);
          const b = Math.floor(129 * intensity);
          const a = 255;

          const index = (y * width + x) * 4;
          if (index < data.length) {
            data[index] = r;
            data[index + 1] = g;
            data[index + 2] = b;
            data[index + 3] = a;
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);

      // Add subtle overlay for depth
      const overlayGradient = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.max(width, height) / 2
      );
      overlayGradient.addColorStop(0, 'rgba(0, 0, 0, 0.1)');
      overlayGradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
      
      ctx.fillStyle = overlayGradient;
      ctx.fillRect(0, 0, width, height);

      time += 1;
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <>
      <style>{`
        html, body {
          margin: 0;
          padding: 0;
          overflow: hidden;
          height: 100dvh;
          width: 100vw;
          position: fixed;
          font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
          touch-action: none;
        }
        
        .silk-canvas {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
        }

        @keyframes wave {
          0%, 100% { transform: translateY(0) rotate(0); }
          50% { transform: translateY(-10px) rotate(5deg); }
        }

        .wave-text {
          animation: wave 3s ease-in-out infinite;
        }

        .hand-wave {
          display: inline-block;
          animation: hand-wave 2.5s infinite;
          transform-origin: 70% 70%;
        }

        @keyframes hand-wave {
          0% { transform: rotate(0deg); }
          10% { transform: rotate(14deg); }
          20% { transform: rotate(-8deg); }
          30% { transform: rotate(14deg); }
          40% { transform: rotate(-4deg); }
          50% { transform: rotate(10deg); }
          60% { transform: rotate(0deg); }
          100% { transform: rotate(0deg); }
        }
      `}</style>
      
      <div className="relative h-dvh w-full overflow-hidden bg-black">
        {/* Animated Silk Background */}
        <canvas 
          ref={canvasRef}
          className="silk-canvas"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/30 via-transparent to-black/50" />

        {/* Content */}
        <div className="relative z-20 flex h-full items-center justify-center">
          <div className="text-center px-8">
            <BlurFade delay={0.3} yOffset={20}>
              <div className="flex flex-col items-center gap-6">
                <div className="wave-text">
                  <Waves className="w-12 h-12 text-white/50 mb-2" />
                </div>
                {/* Main Title */}
                <h1 
                  className="text-6xl sm:text-8xl md:text-9xl lg:text-[12rem] xl:text-[14rem] font-light tracking-[-0.05em] leading-none text-white mix-blend-difference"
                  style={{ 
                    textShadow: '0 0 40px rgba(255, 255, 255, 0.1)'
                  }}
                >
                  hello <span className="hand-wave">👋</span>
                </h1>
              </div>
            </BlurFade>

            <BlurFade delay={0.6} yOffset={10}>
              {/* Subtitle */}
              <div className="mt-8 text-lg md:text-xl lg:text-2xl font-extralight tracking-[0.2em] uppercase text-gray-300/80 mix-blend-overlay">
                <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-0">
                  <span className="inline-block hover:scale-110 transition-transform">Ahmed</span>
                  <span className="hidden md:inline-block mx-4 text-gray-500">•</span>
                  <span className="inline-block hover:scale-110 transition-transform">Ben</span>
                  <span className="hidden md:inline-block mx-4 text-gray-500">•</span>
                  <span className="inline-block hover:scale-110 transition-transform">Abdallah</span>
                </div>
              </div>
            </BlurFade>
          </div>
        </div>

        {/* Corner Accent */}
        <div className="absolute top-8 left-8 z-30">
          <BlurFade delay={1} yOffset={-10}>
            <div className="text-xs font-light tracking-widest uppercase text-gray-500/40 mix-blend-overlay flex items-center gap-2">
              <span className="animate-pulse">●</span> 2025
            </div>
          </BlurFade>
        </div>
      </div>
    </>
  );
};
