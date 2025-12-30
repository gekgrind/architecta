import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import ArchitectaPrismBackground from "@/components/backgrounds/ArchitectaPrismBackground";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: "Architecta — AI Content Studio",
  description:
    "An AI content studio built for founders and small businesses—turning strategy into content and content into growth.",
}

export const viewport: Viewport = {
  themeColor: "#00FFD1",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="relative overflow-x-hidden">
        {/* Global background */}
        <div className="fixed inset-0 -z-10">
  <ArchitectaPrismBackground preset="landing" />
</div>

        {/* App content */}
        {children}
      </body>
    </html>
  );
}
