import "~/styles/globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "PROJECT: [REDACTED]",
  description: "Seek and find. An ARG experience created by Ahmed Ben Abdallah.",
  icons: [{ rel: "icon", url: "/favicon.svg", type: "image/svg+xml" }],
  openGraph: {
    title: "PROJECT: [REDACTED]",
    description: "Phase 1: Initializing Sequence. Seek and find.",
    images: ["/og-image.png"],
    type: "website",
    siteName: "Ahmed Ben Abdallah ARG",
  },
  twitter: {
    card: "summary_large_image",
    title: "PROJECT: [REDACTED]",
    description: "Seek and find. By Ahmed Ben Abdallah.",
    images: ["/og-image.png"],
  },
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans+Code:ital,wght@0,300..800;1,300..800&display=swap"
          rel="stylesheet"
        />

        <link
          href="https://fonts.googleapis.com/css2?family=Doto:wght@100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-black overflow-hidden">
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
