"use client";

type RefineControlsProps = {
  onRefine: (controls: {
    tone?: string;
    length?: string;
    ctaStrength?: string;
  }) => void;
};

export default function RefineControls({ onRefine }: RefineControlsProps) {
  return (
    <div className="space-y-2 text-sm">
      <button
        onClick={() => onRefine({ tone: "clearer" })}
        className="w-full rounded bg-white/10 px-3 py-2"
      >
        Make clearer
      </button>
      <button
        onClick={() => onRefine({ length: "shorter" })}
        className="w-full rounded bg-white/10 px-3 py-2"
      >
        Make shorter
      </button>
      <button
        onClick={() => onRefine({ ctaStrength: "stronger" })}
        className="w-full rounded bg-white/10 px-3 py-2"
      >
        Stronger CTA
      </button>
    </div>
  );
}
