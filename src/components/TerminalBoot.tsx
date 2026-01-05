"use client";

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import Noise from "./noise/noise";

const BOOT_SEQUENCE = [
    "> SEARCHING_FOR_UPLINK...",
    "> RELAY_0xAF4_OPEN",
    "> AUTH: AHMED BEN ABDALLAH",
    "> ACCESS_ING_RESTRICTED_PROTOCOL",
    "> WARN: CORRUPT_MEMORY_BLOCK_77",
    "> OVERRIDE_SAFETY_CHECK",
    "> SYNCING_NEURAL_LINK...",
    "> SYNC_STABLE_98%",
    "> DECRYPTING_STREAM...",
    "> CONNECTION_ESTABLISHED",
];

const WALKER_FRAMES = [
    "   (^_^)  \n  /|   |\\ \n   /   \\  ",
    "   (o_o)  \n  /|___|\\ \n   |   |  ",
    "   (ô_ô)  \n  /|___|\\ \n  /     \\ "
];

export default function TerminalBoot({ onComplete }: { onComplete: () => void }) {
    const [rebootStep, setRebootStep] = useState<"flash" | "dark">("flash");

    useEffect(() => {
        const handleInteraction = () => {
            setRebootStep("dark");
            setTimeout(() => {
                onComplete();
            }, 600);
        };

        window.addEventListener("click", handleInteraction);
        window.addEventListener("keydown", handleInteraction);

        return () => {
            window.removeEventListener("click", handleInteraction);
            window.removeEventListener("keydown", handleInteraction);
        };
    }, [onComplete]);

    // Unused effects kept for preserving code structure if needed in future
    useEffect(() => {
        const interval = setInterval(() => {
            setWalkerFrame(prev => (prev + 1) % WALKER_FRAMES.length);
        }, 300);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setBgData(prev => [Math.random().toString(16).substring(2, 20), ...prev].slice(0, 40));
        }, 50);
        return () => clearInterval(interval);
    }, []);

    if (rebootStep === "flash") {
        return (
            <div className="fixed inset-0 z-[1000] bg-black overflow-hidden flex items-center justify-center">
                <Noise patternAlpha={80} patternRefreshInterval={1} />
                <div className="absolute inset-0 flex items-center justify-center font-doto text-green-500 text-6xl break-all opacity-50 px-20 text-center">
                    {Array.from({ length: 150 }).map(() => Math.random().toString(36)[2]).join('')}
                </div>
                <div className="relative z-10 text-green-400 text-6xl font-black tracking-[0.5em] animate-pulse font-doto drop-shadow-[0_0_15px_rgba(34,197,94,0.8)]">
                    SIGNAL_INTERRUPT_
                </div>
            </div>
        );
    }

    if (rebootStep === "dark") {
        return (
            <div className="fixed inset-0 z-[1000] bg-black flex items-center justify-center font-doto text-green-600">
                <div className="text-2xl tracking-[0.5em] animate-pulse">SYSTEM_REBOOTING_</div>
            </div>
        );
    }

    return null;
}
