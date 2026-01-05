"use client";

import React from "react";

export default function GlitchEffects() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden">
      {/* CRT Scanlines with Green tint */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,50,0,0.1)_50%)] bg-[length:100%_4px] opacity-20" />

      {/* Standard Vignette (Hidden on Mobile) */}
      <div className="hidden md:block absolute inset-0 bg-[radial-gradient(circle,transparent_40%,rgba(0,0,0,0.5)_90%,rgba(0,0,0,0.8)_100%)]" />

      {/* Subtle Flickering */}
      <div className="animate-flicker absolute inset-0 bg-green-900/1 opacity-[0.02]" />

      {/* Green Glitch Overlay */}
      <div className="absolute inset-0 mix-blend-screen opacity-5">
        <div className="animate-glitch-1 absolute inset-0 bg-[rgba(0,255,0,0.2)]" style={{ clipPath: 'inset(10% 0 80% 0)' }} />
        <div className="animate-glitch-2 absolute inset-0 bg-[rgba(0,180,0,0.1)]" style={{ clipPath: 'inset(40% 0 43% 0)' }} />
        <div className="animate-glitch-3 absolute inset-0 bg-[rgba(20,255,20,0.15)]" style={{ clipPath: 'inset(80% 0 5% 0)' }} />
      </div>

      <style jsx global>{`
        @keyframes flicker {
          0% { opacity: 0.02; }
          5% { opacity: 0.05; }
          10% { opacity: 0.03; }
          15% { opacity: 0.04; }
          25% { opacity: 0.02; }
          30% { opacity: 0.06; }
          100% { opacity: 0.02; }
        }

        .animate-flicker {
          animation: flicker 0.15s infinite;
        }

        @keyframes glitch-1 {
          0% { transform: translate(0); }
          20% { transform: translate(-2px, 2px); }
          40% { transform: translate(-2px, -2px); }
          60% { transform: translate(2px, 2px); }
          80% { transform: translate(2px, -2px); }
          100% { transform: translate(0); }
        }

        .animate-glitch-1 {
          animation: glitch-1 4s infinite linear alternate-reverse;
        }
        
        .animate-glitch-2 {
          animation: glitch-1 2.5s infinite linear alternate;
        }

        .animate-glitch-3 {
          animation: glitch-1 3.2s infinite linear alternate-reverse;
        }
      `}</style>
    </div>
  );
}
