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
    checkMobile();
    window.addEventListener("resize", checkMobile);

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(media.matches);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const base = prismPresets[preset];

  const finalProps = {
    ...base,
    // mobile dial-down
    ...(isMobile && {
      scale: base.scale * 0.85,
      glow: base.glow * 0.8,
      timeScale: base.timeScale * 0.7,
    }),
    // accessibility dial-down
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
