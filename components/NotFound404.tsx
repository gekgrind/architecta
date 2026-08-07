"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Oswald, Josefin_Sans } from "next/font/google";
import {
  Rocket,
  Lightbulb,
  Coffee,
  StickyNote,
  BarChart3,
  Target,
  Zap,
  Briefcase,
  Presentation,
  DollarSign,
  Mail,
  Calendar,
  type LucideIcon,
} from "lucide-react";

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-oswald",
  display: "swap",
});

const josefinSans = Josefin_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  variable: "--font-josefin",
  display: "swap",
});

const CORAL = "#FF6B5A";
const GOLD = "#F5C542";
const NAVY = "#0A1628";

const OSWALD = "var(--font-oswald), sans-serif";
const JOSEFIN = "var(--font-josefin), sans-serif";

const ICONS: LucideIcon[] = [
  Rocket,
  Lightbulb,
  Coffee,
  StickyNote,
  BarChart3,
  Target,
  Zap,
  Briefcase,
  Presentation,
  DollarSign,
  Mail,
  Calendar,
];

interface CrowdIcon {
  id: number;
  Icon: LucideIcon;
  left: number;
  top: number;
  rotate: number;
  opacity: number;
  color: string;
  size: number;
  duration: number;
  delay: number;
  tx1: number;
  ty1: number;
  tx2: number;
  ty2: number;
  tx3: number;
  ty3: number;
}

// Content column + gap element exclusion zones, in viewport percentages.
const CONTENT_ZONE = { xMin: 26, xMax: 74, yMin: 20, yMax: 82 };
const GAP_ZONE = { xMin: 1, xMax: 24, yMin: 54, yMax: 82 };

function inZone(
  x: number,
  y: number,
  zone: { xMin: number; xMax: number; yMin: number; yMax: number },
) {
  return x >= zone.xMin && x <= zone.xMax && y >= zone.yMin && y <= zone.yMax;
}

function pickColor(accent: string) {
  const r = Math.random();
  if (r < 0.6) return accent;
  if (r < 0.8) return CORAL;
  return GOLD;
}

function generateCrowd(accent: string): CrowdIcon[] {
  const cols = 14;
  const rows = 10;
  const cellW = 100 / cols;
  const cellH = 100 / rows;

  const cells: { x: number; y: number }[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const jitterX = (Math.random() - 0.5) * cellW * 0.7;
      const jitterY = (Math.random() - 0.5) * cellH * 0.7;
      const x = col * cellW + cellW / 2 + jitterX;
      const y = row * cellH + cellH / 2 + jitterY;
      if (inZone(x, y, CONTENT_ZONE) || inZone(x, y, GAP_ZONE)) continue;
      cells.push({ x, y });
    }
  }

  // Fisher-Yates shuffle (Math.random is safe here: client-only, post-mount)
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  const wander = () => (Math.random() - 0.5) * 140;

  const count = Math.min(68, cells.length);
  return cells.slice(0, count).map((cell, i) => ({
    id: i,
    Icon: ICONS[Math.floor(Math.random() * ICONS.length)],
    left: cell.x,
    top: cell.y,
    rotate: Math.round((Math.random() - 0.5) * 40),
    opacity: 0.3 + Math.random() * 0.4,
    color: pickColor(accent),
    size: 14 + Math.round(Math.random() * 8),
    duration: 14 + Math.random() * 10,
    delay: Math.random() * 6,
    tx1: wander(),
    ty1: wander(),
    tx2: wander(),
    ty2: wander(),
    tx3: wander(),
    ty3: wander(),
  }));
}

interface NotFound404Props {
  accent?: string;
}

export default function NotFound404({ accent = "#22D3EE" }: NotFound404Props) {
  const [crowd, setCrowd] = useState<CrowdIcon[]>([]);
  const [popped, setPopped] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    setCrowd(generateCrowd(accent));
  }, [accent]);

  const handleEasterEgg = () => {
    setPopped(true);
    window.setTimeout(() => setPopped(false), 400);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 3500);
  };

  return (
    <div
      className={`relative min-h-screen w-full overflow-hidden ${oswald.variable} ${josefinSans.variable}`}
      style={{ backgroundColor: NAVY }}
    >
      <style>{`
        @keyframes nf404-float {
          0% { transform: translate(0, 0) rotate(var(--r)); }
          25% { transform: translate(var(--tx1), var(--ty1)) rotate(var(--r)); }
          50% { transform: translate(var(--tx2), var(--ty2)) rotate(var(--r)); }
          75% { transform: translate(var(--tx3), var(--ty3)) rotate(var(--r)); }
          100% { transform: translate(0, 0) rotate(var(--r)); }
        }
        @keyframes nf404-dash {
          to { stroke-dashoffset: -24; }
        }
        @keyframes nf404-pop {
          0% { transform: scale(1); }
          50% { transform: scale(1.4); }
          100% { transform: scale(1); }
        }
        .nf404-icon {
          animation-name: nf404-float;
          animation-duration: var(--dur);
          animation-delay: var(--delay);
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
        .nf404-gap-border {
          animation: nf404-dash 3s linear infinite;
        }
        .nf404-pop {
          animation: nf404-pop 0.4s ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .nf404-icon, .nf404-gap-border, .nf404-pop {
            animation: none !important;
          }
        }
      `}</style>

      {/* Blueprint grid background */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <pattern id="nf404-grid-40" width={40} height={40} patternUnits="userSpaceOnUse">
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke={accent}
              strokeOpacity={0.08}
              strokeWidth={1}
            />
          </pattern>
          <pattern id="nf404-grid-200" width={200} height={200} patternUnits="userSpaceOnUse">
            <path
              d="M 200 0 L 0 0 0 200"
              fill="none"
              stroke={accent}
              strokeOpacity={0.14}
              strokeWidth={1}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#nf404-grid-40)" />
        <rect width="100%" height="100%" fill="url(#nf404-grid-200)" />
      </svg>

      {/* Crowd of founder-themed icons */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {crowd.map(({ id, Icon, left, top, rotate, opacity, color, size, duration, delay, tx1, ty1, tx2, ty2, tx3, ty3 }) => (
          <div
            key={id}
            className="nf404-icon absolute"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              opacity,
              color,
              ["--r" as string]: `${rotate}deg`,
              ["--dur" as string]: `${duration}s`,
              ["--delay" as string]: `${delay}s`,
              ["--tx1" as string]: `${tx1}px`,
              ["--ty1" as string]: `${ty1}px`,
              ["--tx2" as string]: `${tx2}px`,
              ["--ty2" as string]: `${ty2}px`,
              ["--tx3" as string]: `${tx3}px`,
              ["--ty3" as string]: `${ty3}px`,
              transform: `rotate(${rotate}deg)`,
            }}
          >
            <Icon size={size} strokeWidth={1.75} />
          </div>
        ))}
      </div>

      {/* Easter egg: hidden striped beanie */}
      <button
        type="button"
        aria-label="Hidden striped figure"
        onClick={handleEasterEgg}
        className={`absolute z-20 -m-3 p-3 ${popped ? "nf404-pop" : ""}`}
        style={{ left: "88%", top: "38%" }}
      >
        <svg width={20} height={23} viewBox="0 0 20 23" aria-hidden="true">
          <defs>
            <clipPath id="nf404-beanie-clip">
              <path d="M10 1 C4.5 1 1 5.8 1 10.5 L1 17 L19 17 L19 10.5 C19 5.8 15.5 1 10 1 Z" />
            </clipPath>
          </defs>
          <g clipPath="url(#nf404-beanie-clip)">
            <rect x="0" y="0" width="20" height="17" fill="#FFFFFF" />
            <rect x="0" y="3.5" width="20" height="3" fill="#E24B4A" />
            <rect x="0" y="9.5" width="20" height="3" fill="#E24B4A" />
            <rect x="0" y="15.5" width="20" height="3" fill="#E24B4A" />
          </g>
          <path
            d="M10 1 C4.5 1 1 5.8 1 10.5 L1 17 L19 17 L19 10.5 C19 5.8 15.5 1 10 1 Z"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={0.75}
          />
          <rect x="1" y="16" width="18" height="4" rx="1.5" fill="#E24B4A" stroke="#FFFFFF" strokeWidth={0.6} />
          <circle cx="10" cy="1.5" r="2.4" fill="#FFFFFF" stroke="#E24B4A" strokeWidth={0.6} />
        </svg>
      </button>

      {/* The gap */}
      <div
        className="absolute z-10 hidden min-[480px]:flex left-1/2 top-[78%] -translate-x-1/2 sm:left-[6%] sm:top-[62%] sm:translate-x-0 h-[92px] w-[150px] items-center justify-center rounded-md"
        style={{ opacity: 0.85 }}
      >
        <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
          <rect
            x={1}
            y={1}
            width="calc(100% - 2px)"
            height="calc(100% - 2px)"
            rx={6}
            fill="none"
            stroke={accent}
            strokeWidth={1.5}
            strokeDasharray="6 5"
            className="nf404-gap-border"
          />
        </svg>
        <span
          className="relative px-2 text-center text-[11px] uppercase"
          style={{ fontFamily: JOSEFIN, color: accent, letterSpacing: "0.08em" }}
        >
          your page should be here
        </span>
      </div>

      {/* Content column */}
      <div className="pointer-events-none relative z-30 flex min-h-screen w-full flex-col items-center justify-center px-6 text-center">
        <div
          className="leading-none"
          style={{
            fontFamily: OSWALD,
            fontWeight: 600,
            fontSize: "clamp(56px, 14vw, 92px)",
            letterSpacing: "0.04em",
            color: accent,
          }}
        >
          404
        </div>

        <h1
          className="mt-4 max-w-xl"
          style={{
            fontFamily: OSWALD,
            fontWeight: 500,
            fontSize: "26px",
            color: "#FFFFFF",
          }}
        >
          You found the one page that doesn&apos;t exist. Impressive.
        </h1>

        <p
          className="mt-4 max-w-[440px]"
          style={{
            fontFamily: JOSEFIN,
            fontWeight: 300,
            fontSize: "15px",
            color: "#9FB3C8",
          }}
        >
          Honestly, that takes skill. Most people can&apos;t even find their car
          keys. Now put that talent to work somewhere useful.
        </p>

        <Link
          href="/"
          className="pointer-events-auto mt-8 inline-block rounded-[6px] px-6 py-3 uppercase"
          style={{
            backgroundColor: CORAL,
            color: "#3D0E06",
            fontFamily: JOSEFIN,
            fontWeight: 600,
            letterSpacing: "0.06em",
          }}
        >
          Back to Headquarters
        </Link>

        <p
          className="mt-4"
          style={{ fontFamily: JOSEFIN, fontSize: "12px", color: "#5A7086" }}
        >
          Psst — one of these icons is wearing stripes. Find it.
        </p>
      </div>

      {/* Easter egg toast */}
      {toastVisible && (
        <div
          className="fixed bottom-8 left-1/2 z-40 -translate-x-1/2 rounded-md px-5 py-3 text-center shadow-lg"
          style={{
            backgroundColor: GOLD,
            color: "#412402",
            fontFamily: JOSEFIN,
            fontWeight: 600,
          }}
          role="status"
        >
          You found it! Still not the page, though. 10 points for effort.
        </div>
      )}
    </div>
  );
}
