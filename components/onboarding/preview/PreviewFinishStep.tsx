"use client";

/**
 * Safe preview replacement for FinishStep.
 * The real FinishStep auto-fires completeOnboarding() on mount.
 * This version renders the same visual state without any side effects.
 */
export default function PreviewFinishStep() {
  return (
    <div className="text-center space-y-3">
      <p className="text-slate-400">
        Architecta is ready to build your complete brand system.
      </p>
      <p
        style={{
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#6b7280",
          marginTop: "12px",
          letterSpacing: "0.05em",
        }}
      >
        [dev preview — no generation triggered]
      </p>
    </div>
  );
}
