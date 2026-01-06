"use client";

import React from "react";
import LCDGadget from "~/components/retro-demos/LCDGadget";

export default function LCDPage() {
    return (
        <div className="min-h-screen w-full bg-[#333] flex items-center justify-center p-8">
            <LCDGadget scale={1.2} />
        </div>
    );
}
