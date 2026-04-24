"use client";

import { useEffect, useState } from "react";
import Prism from "./Prism";
import { prismPresets, PrismPreset } from "./prismPresets";

type Props = {
  preset: PrismPreset;
};

export default function ArchitectaPrismBackground({ preset }: Props) {
  const [isMobile, setIsMobile] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    const frame = requestAnimationFrame(() => {
      checkMobile();
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReducedMotion(media.matches);
    });
    window.addEventListener("resize", checkMobile);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  const base = prismPresets[preset];

  const finalProps = {
    ...base,
    ...(isMobile && {
      scale: base.scale * 0.85,
      glow: base.glow * 0.8,
      timeScale: base.timeScale * 0.7,
    }),
    ...(reducedMotion && {
      timeScale: 0.1,
    }),
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      <Prism
        {...finalProps}
        suspendWhenOffscreen
        transparent
      />
    </div>
  );
}
