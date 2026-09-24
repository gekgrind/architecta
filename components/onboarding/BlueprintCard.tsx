"use client";

import { useEffect, useState } from "react";
import StepRenderer, { type OnboardingContext } from "./steps/StepRenderer";
import type { OnboardingStep } from "@/lib/onboarding/types";

type Props = {
  step: OnboardingStep;
  context: OnboardingContext;
  isFirst: boolean;
  isLast: boolean;
  onBack?: () => void;
  onForwardStart?: () => void;
  renderStep?: (step: OnboardingStep, context: OnboardingContext) => React.ReactNode;
};

export default function BlueprintCard({
  step,
  context,
  isFirst,
  onBack,
  onForwardStart,
  renderStep,
}: Props) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setActive(true), 40);
    return () => clearTimeout(t);
  }, [step.id]);

  const isWelcome = step.type === "welcome";

  return (
    <div className={`blueprint-card ${active ? "active" : ""}`}>
      <div className="construction-lines">
        <div className="construction-line horizontal construction-line-1" />
        <div className="construction-line horizontal construction-line-2" />
        <div className="construction-line horizontal construction-line-3" />
        <div className="construction-line vertical construction-line-4" />
        <div className="construction-line vertical construction-line-5" />
      </div>

      <div className="dimension-marker dimension-top">REF {step.number}</div>
      <div className="dimension-marker dimension-right">SCALE 1:1</div>

      <div className="tech-annotation annotation-1">PRIMARY INPUT</div>
      <div className="tech-annotation annotation-2">USER RESPONSE</div>

      <div className="crosshair crosshair-tl" />
      <div className="crosshair crosshair-br" />

      <div className="blueprint-corner corner-tl" />
      <div className="blueprint-corner corner-tr" />
      <div className="blueprint-corner corner-bl" />
      <div className="blueprint-corner corner-br" />

      <div className="blueprint-light light-1" />
      <div className="blueprint-light light-2" />

      <div className="card-stamp">
        REV. {step.number}
        <br />
        ARCHITECTA
      </div>

      <div className="card-content">
        <div className="card-number">STEP {step.number}</div>

        <h2 className="question">{step.title}</h2>
        {step.subtitle && <p className="subhead">{step.subtitle}</p>}

        {renderStep ? renderStep(step, context) : <StepRenderer step={step} context={context} />}

        {isWelcome && (
          <div className="button-group">
            {!isFirst && onBack && (
              <button type="button" className="btn" onClick={onBack}>
                Back
              </button>
            )}

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onForwardStart?.()}
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
