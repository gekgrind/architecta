"use client";

type ThemeMode = "dark" | "light";

export default function BlueprintBackground({ theme }: { theme: ThemeMode }) {
  const isDark = theme === "dark";

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {/* Base */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: isDark ? "#122942" : "#ffffff" }}
      />

      {/* Grid */}
      <svg className={`absolute inset-0 w-full h-full ${isDark ? "opacity-20" : "opacity-10"}`}>
        <defs>
          <pattern id="majorGrid" width="100" height="100" patternUnits="userSpaceOnUse">
            <path
              d="M 100 0 L 0 0 0 100"
              fill="none"
              stroke={isDark ? "#4a9eff" : "#cbd5e1"}
              strokeWidth="0.5"
            />
          </pattern>
          <pattern id="minorGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke={isDark ? "#2563eb" : "#e2e8f0"}
              strokeWidth="0.25"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#minorGrid)" />
        <rect width="100%" height="100%" fill="url(#majorGrid)" />
      </svg>

      {/* Corners */}
      <div className={`absolute top-6 left-6 w-16 h-16 border-l-2 border-t-2 ${isDark ? "border-cyan-400/40" : "border-cyan-600/30"}`} />
      <div className={`absolute top-6 right-6 w-16 h-16 border-r-2 border-t-2 ${isDark ? "border-cyan-400/40" : "border-cyan-600/30"}`} />
      <div className={`absolute bottom-6 left-6 w-16 h-16 border-l-2 border-b-2 ${isDark ? "border-cyan-400/40" : "border-cyan-600/30"}`} />
      <div className={`absolute bottom-6 right-6 w-16 h-16 border-r-2 border-b-2 ${isDark ? "border-cyan-400/40" : "border-cyan-600/30"}`} />

      {isDark && (
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-[#0a1929]/50" />
      )}
    </div>
  );
}
