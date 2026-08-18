import type React from "react";
import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

import "./globals.css";
import { ClickSpark } from "@/components/global/ClickSpark";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Architecta — AI Content Studio",
  description:
    "An AI content studio built for founders and small businesses—turning strategy into content and content into growth.",
};

export const viewport: Viewport = {
  themeColor: "#00FFD1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable}`}
    >
      <body className="relative overflow-x-hidden antialiased">
        <ClickSpark />

        {/* Global theme + blueprint background */}
        <ThemeProvider>
          {children}
        </ThemeProvider>

        {/* Vercel Analytics */}
        <Analytics />
      </body>
    </html>
  );
}
