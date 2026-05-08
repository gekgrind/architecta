"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";

import { cn } from "@/lib/utils";

type DashboardCardProps = {
  children: ReactNode;
  className?: string;
  title?: string;
  icon?: LucideIcon;
};

export function DashboardCard({ children, className, title, icon: Icon }: DashboardCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [4, -4]), { damping: 24, stiffness: 180 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-4, 4]), { damping: 24, stiffness: 180 });

  function handleMouseMove(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;

    mouseX.set(x);
    mouseY.set(y);
    event.currentTarget.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
  }

  function handleMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={shouldReduceMotion ? undefined : { rotateX, rotateY, transformStyle: "preserve-3d" }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0B2B57]/40 p-6 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] backdrop-blur-xl transition duration-300",
        "hover:border-[#00D4FF]/45 hover:bg-[#0B2B57]/60 hover:shadow-[0_0_15px_rgba(0,212,255,0.3)]",
        "before:pointer-events-none before:absolute before:inset-0 before:opacity-0 before:transition before:duration-300 before:content-[''] before:[background:radial-gradient(420px_circle_at_var(--mouse-x,50%)_var(--mouse-y,50%),rgba(0,212,255,0.14),transparent_42%)] group-hover:before:opacity-100",
        className
      )}
    >
      <div className="relative z-10" style={shouldReduceMotion ? undefined : { transform: "translateZ(34px)" }}>
        {title ? (
          <div className="mb-6 flex items-center gap-3">
            {Icon ? (
              <div className="rounded-lg bg-[#00D4FF]/10 p-2 text-[#00D4FF] transition-transform group-hover:scale-105">
                <Icon size={18} />
              </div>
            ) : null}
            <h2 className="font-[var(--font-science-gothic,var(--font-inter))] text-base font-semibold tracking-tight text-white">
              {title}
            </h2>
            <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[#00D4FF] shadow-[0_0_8px_#00D4FF]" />
          </div>
        ) : null}
        {children}
      </div>
    </motion.div>
  );
}
