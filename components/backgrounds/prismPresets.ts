export type PrismPreset =
  | "landing"
  | "dashboard"
  | "auth";

export type PrismPresetConfig = {
  animationType: "rotate";
  timeScale: number;
  scale: number;
  glow: number;
  noise: number;
  colorFrequency: number;
  hueShift: number;
};

export const prismPresets: Record<PrismPreset, PrismPresetConfig> = {
  landing: {
    animationType: "rotate",
    timeScale: 0.35,
    scale: 2.9,
    glow: 0.75,
    noise: 0,
    colorFrequency: 0.9,
    hueShift: -0.12,
  },

  dashboard: {
    animationType: "rotate",
    timeScale: 0.18,
    scale: 2.4,
    glow: 0.45,
    noise: 0,
    colorFrequency: 0.65,
    hueShift: -0.18,
  },

  auth: {
    animationType: "rotate",
    timeScale: 0.28,
    scale: 2.6,
    glow: 0.6,
    noise: 0,
    colorFrequency: 0.8,
    hueShift: -0.15,
  },
};
