"use client";

import type { KeyboardEvent } from "react";
import { Check } from "lucide-react";

const NEXT_KEYS = ["ArrowDown", "ArrowRight"];
const PREV_KEYS = ["ArrowUp", "ArrowLeft"];

/**
 * WAI-ARIA radio group keyboard support: arrow keys move focus to the
 * next/previous radio in the group (wrapping) and select it; Home/End jump
 * to the first/last radio.
 */
function handleRadioKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
  const { key } = event;
  if (![...NEXT_KEYS, ...PREV_KEYS, "Home", "End"].includes(key)) return;

  const group = event.currentTarget.closest('[role="radiogroup"]');
  if (!group) return;

  const radios = Array.from(
    group.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)')
  );
  const current = radios.indexOf(event.currentTarget);
  if (radios.length === 0 || current === -1) return;

  event.preventDefault();

  let next = current;
  if (NEXT_KEYS.includes(key)) next = (current + 1) % radios.length;
  else if (PREV_KEYS.includes(key)) next = (current - 1 + radios.length) % radios.length;
  else if (key === "Home") next = 0;
  else if (key === "End") next = radios.length - 1;

  radios[next].focus();
  radios[next].click();
}

type ChoiceCardProps = {
  title: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
  /**
   * "single": radio semantics (place inside a role="radiogroup") with a
   * radio-style indicator. "multi": toggle-button semantics with a
   * checkbox-style indicator.
   */
  mode?: "single" | "multi";
  compact?: boolean;
  disabled?: boolean;
  /**
   * Single mode only: whether this radio is the group's tab stop (roving
   * tabindex). Pass true for the selected option, or for the first option
   * when nothing is selected yet.
   */
  tabStop?: boolean;
};

export default function ChoiceCard({
  title,
  description,
  selected,
  onSelect,
  mode = "single",
  compact = false,
  disabled = false,
  tabStop = true,
}: ChoiceCardProps) {
  const isSingle = mode === "single";

  return (
    <button
      type="button"
      {...(isSingle
        ? {
            role: "radio",
            "aria-checked": selected,
            tabIndex: tabStop ? 0 : -1,
            onKeyDown: handleRadioKeyDown,
          }
        : { "aria-pressed": selected })}
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
