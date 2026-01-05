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
    const [lines, setLines] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [walkerFrame, setWalkerFrame] = useState(0);
    const [bgData, setBgData] = useState<string[]>([]);
    const [rebootStep, setRebootStep] = useState<"none" | "flash" | "dark">("none");

    useEffect(() => {
        const interval = setInterval(() => {
            setWalkerFrame(prev => (prev + 1) % WALKER_FRAMES.length);
            const [rebootStep, setRebootStep] = useState<"flash" | "dark">("flash");
            const [isInteracting, setIsInteracting] = useState(false);

            useEffect(() => {
                const handleInteraction = () => {
                    if (isInteracting) return;
                    setIsInteracting(true);

                    setRebootStep("dark");

                    setTimeout(() => {
                        onComplete();
                    }, 1200);
                };

                const events = ["keydown", "click", "touchstart"];
                events.forEach(e => window.addEventListener(e, handleInteraction));

                return () => {
                    events.forEach(e => window.removeEventListener(e, handleInteraction));
                };
            }, [isInteracting, onComplete]);

            return (
                <motion.div
                    className="fixed inset-0 z-[1000] bg-black overflow-hidden flex flex-col items-center justify-center cursor-pointer"
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    {rebootStep === "flash" && (
                        <>
                            <Noise patternAlpha={80} patternRefreshInterval={1} />
                            <div className="absolute inset-0 flex items-center justify-center font-doto text-green-500 text-6xl break-all opacity-20 px-20 text-center pointer-events-none select-none">
                                {Array.from({ length: 150 }).map(() => Math.random().toString(36)[2]).join('')}
                            </div>

                            <div className="relative z-10 flex flex-col items-center gap-8 pointer-events-none">
                                <div className="text-green-400 text-3xl md:text-6xl font-black tracking-[0.2em] md:tracking-[0.5em] animate-pulse font-doto drop-shadow-[0_0_15px_rgba(34,197,94,0.8)] text-center">
                                    SIGNAL_INTERRUPT_
                                </div>
                                <div className="text-green-500/60 font-mono text-xs md:text-sm tracking-widest animate-pulse">
                                    [ CLICK TO INITIALIZE ]
                                </div>
                            </div>
                        </>
                    )}

                    {rebootStep === "dark" && (
                        <div className="flex items-center justify-center font-doto text-green-600">
                            <div className="text-xl md:text-2xl tracking-[0.5em] animate-pulse">SYSTEM_REBOOTING_</div>
                        </div>
                    )}
                </motion.div>
            );
        }
