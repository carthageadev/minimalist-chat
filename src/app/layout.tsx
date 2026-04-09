import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ahmed Ben Abdallah | Portfolio",
  description: "A digital showcase of flowing texture and minimalist art. This is my professional portfolio.",
  metadataBase: new URL("https://ahmed-is-a-dev.vercel.app"), // Placeholder, update if needed
  openGraph: {
    title: "Ahmed Ben Abdallah | Portfolio",
    description: "Seeking simplicity in complexity. Explorer of digital flowing texture and art.",
    url: "https://ahmed-is-a-dev.vercel.app",
    siteName: "Ahmed Ben Abdallah Portfolio",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Ahmed Ben Abdallah Portfolio Banner",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ahmed Ben Abdallah | Portfolio",
    description: "A digital showcase of flowing texture and minimalist art.",
    images: ["/og-image.png"],
  },
  themeColor: "#050505",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      style={{ colorScheme: "dark" }}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-black text-white">
        {children}
      </body>
    </html>
  );
}
