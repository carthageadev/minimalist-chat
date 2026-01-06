import Link from "next/link";

export default function RetroDemosPage() {
    return (
        <div className="min-h-screen w-full bg-black text-green-500 font-mono flex flex-col items-center justify-center gap-8 p-8">
            <h1 className="text-4xl font-bold mb-8 glow-text">RETRO UI DEMOS</h1>

            <div className="flex flex-col md:flex-row gap-8">
                <Link
                    href="/retro-demos/crt"
                    className="group relative border border-green-700 bg-green-900/10 p-8 rounded-lg hover:bg-green-900/30 transition-all w-64 text-center overflow-hidden"
                >
                    <div className="absolute inset-0 bg-green-500/0 group-hover:bg-green-500/5 transition-all" />
                    <div className="text-6xl mb-4">📺</div>
                    <h2 className="text-2xl font-bold mb-2">CRT Terminal</h2>
                    <p className="text-green-500/70 text-sm">Nexus-7 inspired retro curved screen terminal.</p>
                </Link>

                <Link
                    href="/retro-demos/lcd"
                    className="group relative border border-green-700 bg-green-900/10 p-8 rounded-lg hover:bg-green-900/30 transition-all w-64 text-center overflow-hidden"
                >
                    <div className="absolute inset-0 bg-green-500/0 group-hover:bg-green-500/5 transition-all" />
                    <div className="text-6xl mb-4">📟</div>
                    <h2 className="text-2xl font-bold mb-2">LCD Gadget</h2>
                    <p className="text-green-500/70 text-sm">Industrial handheld device interface.</p>
                </Link>
            </div>

            <Link href="/" className="mt-12 text-green-500/50 hover:text-green-500 underline">
                Return to Home
            </Link>
        </div>
    );
}
