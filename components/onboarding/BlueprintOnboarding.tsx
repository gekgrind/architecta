"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, type Variants } from "framer-motion";

import "./blueprint.css";

import { ONBOARDING_STEPS } from "@/lib/onboarding/steps";
import type { OnboardingStep } from "@/lib/onboarding/types";
import BlueprintCard from "./BlueprintCard";
import { advanceArchitectaOnboardingStepClient } from "@/lib/onboarding/actions";

type Props = {
  step: string;
};

type Direction = "forward" | "back";

/**
 * Motion tuning per step
 * Early steps = energetic
 * Later steps = calmer / heavier
 */
function motionProfileFor(stepId: string) {
  if (stepId === "welcome" || stepId === "source") {
    return { stiffness: 520, damping: 34, mass: 0.7, exitDuration: 0.42 };
  }

  if (stepId === "review" || stepId === "finish") {
    return { stiffness: 260, damping: 42, mass: 1.1, exitDuration: 0.55 };
  }

  return { stiffness: 360, damping: 36, mass: 0.9, exitDuration: 0.48 };
}

export default function BlueprintOnboarding({ step }: Props) {
  const router = useRouter();
  const steps = ONBOARDING_STEPS as OnboardingStep[];

  const stepIndex = useMemo(
    () => steps.findIndex((s) => s.id === step),
    [steps, step]
  );

  const currentStep = steps[stepIndex];
  const progress =
    steps.length > 0 ? ((stepIndex + 1) / steps.length) * 100 : 0;

  const [direction, setDirection] = useState<Direction>("forward");

  if (!currentStep) return null;

  const goBack = () => {
    const prev = steps[stepIndex - 1];
    if (!prev) return;
    setDirection("back");
    router.push("/onboarding/init");;
  };

  const onForwardStart = async () => {
    setDirection("forward");

    const res = await advanceArchitectaOnboardingStepClient(currentStep.id);

    if (res.ok && res.next) {
      router.push(res.next);
    }
  };

  const profile = motionProfileFor(currentStep.id);

  /**
   * IMPORTANT:
   * Explicitly type variants as Variants
   * to satisfy Framer Motion + TS when using `custom`
   */
  const variants: Variants = {
    initial: (dir: Direction) => ({
      opacity: 0,
      x: dir === "forward" ? 28 : -28,
      y: 10,
      filter: "blur(6px)",
    }),

    animate: {
      opacity: 1,
      x: 0,
      y: 0,
      filter: "blur(0px)",
      transition: {
        type: "spring",
        stiffness: profile.stiffness,
        damping: profile.damping,
        mass: profile.mass,
      },
    },

    exit: (dir: Direction) => ({
      opacity: 0,
      x: dir === "forward" ? -28 : 28,
      y: -8,
      filter: "blur(8px)",
      transition: {
        duration: profile.exitDuration,
        ease: [0.22, 1, 0.36, 1],
      },
    }),
  };

  return (
    <>
      {/* Progress */}
      <div className="progress-bar-wrapper">
        <div
          className="progress-bar"
          style={{ width: `${progress}%` }}
          aria-hidden
        />
      </div>

      <div className="onboarding-container">
        <div className="header">
          <h1>ARCHITECTA</h1>
          <p>Building Your Brand System</p>
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep.id}
            custom={direction}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <BlueprintCard
              step={currentStep}
              isFirst={stepIndex === 0}
              isLast={stepIndex === steps.length - 1}
              onBack={goBack}
              onForwardStart={onForwardStart}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
