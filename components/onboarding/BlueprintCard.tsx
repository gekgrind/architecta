"use client";

import { useEffect, useState, useTransition } from "react";
import StepRenderer from "./steps/StepRenderer";
import type { OnboardingStep } from "@/lib/onboarding/types";
import { advanceArchitectaOnboardingStepClient } from "@/lib/onboarding/actions";

type Props = {
  step: OnboardingStep;
  isFirst: boolean;
  isLast: boolean;
  onBack?: () => void;

  // NEW: parent-controlled animation hooks
  onForwardStart?: () => void;
};

export default function BlueprintCard({
  step,
  isFirst,
  isLast,
  onBack,
  onForwardStart,
}: Props) {
  const [active, setActive] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => setActive(true), 40);
    return () => clearTimeout(t);
  }, [step.id]);

  function handleContinue() {
    if (isPending) return;

    onForwardStart?.();

    startTransition(async () => {
      const res = await advanceArchitectaOnboardingStepClient(step.id);
      if (res.ok) {
        // navigation handled by parent (BlueprintOnboarding) via router.push
        // but we can safely just change window location here if needed.
        // We'll let parent do it for animated exits.
      }
    });
  }

  return (
    <div className={`blueprint-card ${active ? "active" : ""}`}>
      {/* Construction lines */}
      <div className="construction-lines">
        <div className="construction-line horizontal construction-line-1" />
        <div className="construction-line horizontal construction-line-2" />
        <div className="construction-line horizontal construction-line-3" />
        <div className="construction-line vertical construction-line-4" />
        <div className="construction-line vertical construction-line-5" />
      </div>

      {/* Dimension markers */}
      <div className="dimension-marker dimension-top">REF {step.number}</div>
      <div className="dimension-marker dimension-right">SCALE 1:1</div>

      {/* Technical annotations */}
      <div className="tech-annotation annotation-1">PRIMARY INPUT</div>
      <div className="tech-annotation annotation-2">USER RESPONSE</div>

      {/* Crosshairs */}
      <div className="crosshair crosshair-tl" />
      <div className="crosshair crosshair-br" />

      {/* Blueprint corners */}
      <div className="blueprint-corner corner-tl" />
      <div className="blueprint-corner corner-tr" />
      <div className="blueprint-corner corner-bl" />
      <div className="blueprint-corner corner-br" />

      {/* Ambient lights */}
      <div className="blueprint-light light-1" />
      <div className="blueprint-light light-2" />

      {/* Stamp */}
      <div className="card-stamp">
        REV. {step.number}
        <br />
        ARCHITECTA
      </div>

      {/* Content */}
      <div className="card-content">
        <div className="card-number">STEP {step.number}</div>

        <h2 className="question">{step.title}</h2>
        {step.subtitle && <p className="subhead">{step.subtitle}</p>}

        <StepRenderer step={step} />

        <div className="button-group">
          {!isFirst && onBack && (
            <button type="button" className="btn" onClick={onBack} disabled={isPending}>
              Back
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleContinue}
            disabled={isPending}
          >
            {isPending ? "Saving…" : isLast ? "Generate Brand System" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
