"use client";

import { useEffect, useState } from "react";
import StepRenderer, { type OnboardingContext } from "./steps/StepRenderer";
import StepNavigation from "./StepNavigation";
import type { OnboardingStep } from "@/lib/onboarding/types";

type Props = {
  step: OnboardingStep;
  context: OnboardingContext;
  isFirst: boolean;
  isLast: boolean;
  onBack?: () => void;
  onForwardStart?: () => void;
};

export default function BlueprintCard({
  step,
  context,
  onForwardStart,
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

      <div className="crosshair crosshair-tl" />
      <div className="crosshair crosshair-br" />

      <div className="blueprint-corner corner-tl" />
      <div className="blueprint-corner corner-tr" />
      <div className="blueprint-corner corner-bl" />
      <div className="blueprint-corner corner-br" />

      <div className="blueprint-light light-1" />
      <div className="blueprint-light light-2" />

      <div className="card-content">
        <header className="card-meta">
          <div className="card-meta-step">
            <span className="card-meta-index">STEP {step.number}</span>
            <span className="card-meta-name">{step.title}</span>
          </div>
          <span className="card-meta-mark">ARCHITECTA</span>
        </header>

        <div className="question-block">
          <h1 className="question">{step.prompt}</h1>
          {step.subtitle && <p className="subhead">{step.subtitle}</p>}
        </div>

        <StepRenderer step={step} context={context} />

        {isWelcome && (
          <div className="mt-8">
            <StepNavigation
              backUrl={null}
              isPending={false}
              onContinue={() => onForwardStart?.()}
            />
          </div>
        )}
      </div>
    </div>
  );
}
