"use client";

import React from "react";
import CRTTerminal from "~/components/retro-demos/CRTTerminal";

export default function CRTPage() {
    return (
        <div className="min-h-screen w-full bg-[#111] flex items-center justify-center p-8">
            <CRTTerminal scale={1.2} />
        </div>
    );
}
