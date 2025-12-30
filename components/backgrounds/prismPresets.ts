export type PrismPreset = "landing" | "dashboard";

export const prismPresets: Record<PrismPreset, any> = {
  landing: {
    animationType: "rotate",
    timeScale: 0.35,
    scale: 2.9,
    glow: 0.75,
    noise: 0,
    colorFrequency: 0.9,
    hueShift: -0.12, // brand-aligned, subtle
  },

  dashboard: {
    animationType: "rotate",
    timeScale: 0.18, // 👈 reduced motion
    scale: 2.4,      // 👈 calmer geometry
    glow: 0.45,
    noise: 0,
    colorFrequency: 0.65,
    hueShift: -0.18,
  },
};
