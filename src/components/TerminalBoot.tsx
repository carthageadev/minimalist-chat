"use client";

import React, { useState, useEffect, useRef } from "react";
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

const CLUES = [
    "WHO_ARE_YOU?",
    "LOOK_CLOSER",
    "01:00_AM",
    "TIME_IS_KEY",
    "THEY_ARE_WATCHING",
    "NOT_FOUND_404",
    "SYSTEM_FAILURE",
    "TRY_AGAIN_LATER"
];

export default function TerminalBoot({ onComplete, forceMode }: { onComplete: () => void, forceMode?: "chat" | "glitch" }) {
    const [rebootStep, setRebootStep] = useState<"flash" | "dark" | "checking">("checking");
    const [mainText, setMainText] = useState("SIGNAL_INTERRUPT_");

    useEffect(() => {
        // Handle forced modes directly
        if (forceMode === "glitch") {
            setRebootStep("flash");
            return;
        }

        // Time-based Gatekeeper
        // Only open between 1:00 AM and 2:00 AM
        const now = new Date();
        const currentHour = now.getHours();

        if (currentHour === 1) {
            onComplete();
        } else {
            setRebootStep("flash");
        }
    }, [onComplete, forceMode]);

    useEffect(() => {
        // Secret Code: "O" + "U" + "T"
        const keys = new Set<string>();

        const handleDown = (e: KeyboardEvent) => {
            keys.add(e.key.toLowerCase());
            if (keys.has("o") && keys.has("u") && keys.has("t")) {
                setRebootStep("dark");
                setTimeout(() => {
                    onComplete();
                }, 1000);
            }
        };

        const handleUp = (e: KeyboardEvent) => {
            keys.delete(e.key.toLowerCase());
        };

        window.addEventListener("keydown", handleDown);
        window.addEventListener("keyup", handleUp);
        return () => {
            window.removeEventListener("keydown", handleDown);
            window.removeEventListener("keyup", handleUp);
        };
    }, [onComplete]);



    const [glitchText, setGlitchText] = useState("");

    const [displayText, setDisplayText] = useState("SIGNAL_INTERRUPT_");
    const targetTextRef = useRef("SIGNAL_INTERRUPT_");

    useEffect(() => {
        if (rebootStep !== "flash") return;

        // Background Matrix/Noise text
        const interval = setInterval(() => {
            setGlitchText(Array.from({ length: 150 }).map(() => Math.random().toString(36)[2]).join(''));
        }, 50);

        // Clue Scheduler
        const clueInterval = setInterval(() => {
            if (Math.random() > 0.8) {
                const randomClue = CLUES[Math.floor(Math.random() * CLUES.length)] || "SIGNAL_LOST";
                targetTextRef.current = randomClue;

                // Return to main text after 2 seconds
                setTimeout(() => {
                    targetTextRef.current = "SIGNAL_INTERRUPT_";
                }, 2000);
            }
        }, 1000);

        // Advanced Per-Character Glitch Loop
        const glitchFrame = setInterval(() => {
            const target = targetTextRef.current;
            const GLITCH_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";

            setDisplayText(current => {
                let next = "";
                const len = Math.max(current.length, target.length);

                for (let i = 0; i < len; i++) {
                    const charC = current[i] || "";
                    const charT = target[i] || "";

                    // 1. Random occasional glitch (stability break)
                    if (Math.random() < 0.02) {
                        next += GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
                        continue;
                    }

                    // 2. Convergence
                    if (charC === charT) {
                        next += charC;
                    } else {
                        // 3. Transition logic
                        if (Math.random() < 0.25) { // 25% chance to snap to correct char
                            next += charT;
                        } else {
                            // Show random char while transitioning
                            next += GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
                        }
                    }
                }
                return next;
            });
        }, 50);

        return () => {
            clearInterval(interval);
            clearInterval(clueInterval);
            clearInterval(glitchFrame);
        };
    }, [rebootStep]);

    if (rebootStep === "flash") {
        return (
            <div className="fixed inset-0 z-[1000] bg-black overflow-hidden flex items-center justify-center">
                <Noise patternAlpha={80} patternRefreshInterval={1} />
                <div className="absolute inset-0 flex items-center justify-center font-doto text-green-500 text-6xl break-all opacity-50 px-20 text-center select-none pointer-events-none">
                    {glitchText}
                </div>
                <div className="relative z-10 text-green-400 text-6xl font-black tracking-[0.5em] animate-pulse font-doto drop-shadow-[0_0_15px_rgba(34,197,94,0.8)]">
                    {displayText}
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

    // Avoid flash on desktop
    if (rebootStep === "checking") {
        return <div className="fixed inset-0 z-[1000] bg-black" />;
    }

    return null;
}
