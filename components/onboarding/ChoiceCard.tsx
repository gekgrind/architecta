"use client";

import { Check } from "lucide-react";

type ChoiceCardProps = {
  title: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
  /** "single" renders a radio-style indicator, "multi" a checkbox-style one */
  mode?: "single" | "multi";
  compact?: boolean;
  disabled?: boolean;
};

export default function ChoiceCard({
  title,
  description,
  selected,
  onSelect,
  mode = "single",
  compact = false,
  disabled = false,
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      data-mode={mode}
      disabled={disabled}
      onClick={onSelect}
      className={`bp-choice${compact ? " bp-choice-compact" : ""}`}
    >
      <span className="bp-choice-indicator" aria-hidden>
        <Check size={13} strokeWidth={3.25} />
      </span>
      <span className="bp-choice-body">
        <span className="bp-choice-title">{title}</span>
        {description && (
          <span className="bp-choice-description">{description}</span>
        )}
      </span>
    </button>
  );
}
