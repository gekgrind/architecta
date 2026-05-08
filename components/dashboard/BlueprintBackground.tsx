"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

const nodes = [
  { cx: "14%", cy: "22%", delay: 0.2 },
  { cx: "28%", cy: "74%", delay: 1.1 },
  { cx: "41%", cy: "36%", delay: 2.2 },
  { cx: "57%", cy: "68%", delay: 0.8 },
  { cx: "69%", cy: "24%", delay: 1.7 },
  { cx: "81%", cy: "54%", delay: 2.8 },
  { cx: "92%", cy: "32%", delay: 0.5 },
  { cx: "73%", cy: "86%", delay: 3.1 },
];

export function BlueprintBackground() {
  const shouldReduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const fineGridY = useTransform(scrollY, [0, 1000], [0, shouldReduceMotion ? 0 : -90]);
  const majorGridY = useTransform(scrollY, [0, 1000], [0, shouldReduceMotion ? 0 : -150]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#041C3B]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(0,212,255,0.15),transparent_30%),radial-gradient(circle_at_84%_14%,rgba(8,126,255,0.18),transparent_34%),linear-gradient(135deg,#041C3B_0%,#061935_48%,#041C3B_100%)]" />

      <motion.div
        className="absolute inset-0 h-[120%] opacity-35"
        style={{
          y: fineGridY,
          backgroundImage:
            "linear-gradient(to right, rgba(0, 212, 255, 0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 212, 255, 0.14) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <motion.div
        className="absolute inset-0 h-[140%] opacity-24"
        style={{
          y: majorGridY,
          backgroundImage:
            "linear-gradient(to right, rgba(0, 212, 255, 0.28) 2px, transparent 2px), linear-gradient(to bottom, rgba(0, 212, 255, 0.28) 2px, transparent 2px)",
          backgroundSize: "200px 200px",
        }}
      />

      <svg className="absolute inset-0 h-full w-full opacity-20" aria-hidden="true">
        <defs>
          <linearGradient id="architecta-line-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00D4FF" stopOpacity="0" />
            <stop offset="50%" stopColor="#00D4FF" stopOpacity="1" />
            <stop offset="100%" stopColor="#00D4FF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.circle
          cx="20%"
          cy="30%"
          r="150"
          fill="none"
          stroke="url(#architecta-line-grad)"
          strokeWidth="2"
          animate={shouldReduceMotion ? undefined : { scale: [1, 1.12, 1], opacity: [0.2, 0.45, 0.2] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.path
          d="M 0 100 L 1000 1000 M 100 0 L 1100 900"
          stroke="url(#architecta-line-grad)"
          strokeWidth="1"
          animate={shouldReduceMotion ? undefined : { pathLength: [0, 1, 0], opacity: [0.18, 0.55, 0.18] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        {nodes.map((node) => (
          <motion.circle
            key={`${node.cx}-${node.cy}`}
            cx={node.cx}
            cy={node.cy}
            r="1"
            fill="#00D4FF"
            animate={shouldReduceMotion ? undefined : { opacity: [0, 1, 0], scale: [0, 2, 0] }}
            transition={{ duration: 7, repeat: Infinity, delay: node.delay, ease: "easeInOut" }}
          />
        ))}
      </svg>

      <div className="absolute inset-0 bg-gradient-to-t from-[#041C3B] via-transparent to-[#041C3B]/50" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#041C3B] via-transparent to-[#041C3B]/50" />
    </div>
  );
}
