"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, MotionConfig, motion, type Variants } from "framer-motion";

import "@/components/onboarding/blueprint.css";

import { ONBOARDING_STEPS } from "@/lib/onboarding/steps";
import type { OnboardingStep } from "@/lib/onboarding/types";
import type { OnboardingContext } from "@/components/onboarding/steps/StepRenderer";
import BlueprintCard from "@/components/onboarding/BlueprintCard";
import PreviewFinishStep from "./PreviewFinishStep";

// ---------------------------------------------------------------------------
// Representative preview data — purely for visual QA, never written anywhere
// ---------------------------------------------------------------------------
const PREVIEW_CONTEXT: OnboardingContext = {
  answers: {
    source_type: "existing",
    has_website: true,
    website_url: "https://acme-studio.com",
    brand_name: "Acme Studio",
    industry: "B2B SaaS",
    description:
      "We help early-stage founders launch profitable products with less friction and more clarity.",
    primary_market: "B2B SaaS founders",
    niche: "Solo founders and small bootstrapped teams",
    competitors: ["Notion", "Canva", "ConvertKit"],
    customer_role: "Solo SaaS founder",
    customer_pains: [
      "Inconsistent content",
      "No time to create content",
      "Unclear positioning",
    ],
    customer_outcome:
      "A clear, repeatable content system that sounds like them",
    brand_values: ["Clarity", "Integrity", "Innovation"],
    brand_personality: { boldness: 70, tone: 40, authority: 75 },
    voice_tone: "direct",
    words_to_use: ["strategic", "clear", "system", "founder"],
    words_to_avoid: ["hype", "guru", "crush it", "hustle"],
    reference_brands: ["Basecamp", "Notion", "Linear"],
    visual_style: "minimal",
    primary_colors: ["#6366f1", "#0f172a"],
    has_logo: true,
    mission: "Make brand-building accessible to every founder.",
    vision: "A world where great brands aren't gatekept by agencies.",
    website_analysis: {
      brand_name: "Acme Studio",
      industry: "B2B SaaS",
      description: "Strategic content tools for modern founders",
      audience: "Solo founders, indie hackers, and bootstrapped teams",
      offers: "Brand kit generation, content strategy templates",
      tone: "Direct, confident, practical",
      voice_characteristics: "Clear, no-fluff, founder-to-founder",
      topics: ["brand building", "content strategy", "growth marketing"],
      mission: "Make brand-building accessible to every founder.",
      values: "Clarity, Integrity, Simplicity",
      differentiators: ["Built for solo founders", "System-first approach"],
      cta_patterns: ["Start building", "Get your brand kit"],
      typical_customers: "Solo founders and small bootstrapped teams",
      confidence: "high",
      analyzed_at: new Date().toISOString(),
    },
  },
  sessionId: "preview-session-00000000",
  hasExistingContext: true,
  websiteUrl: "https://acme-studio.com",
};

// ---------------------------------------------------------------------------
// Animation helpers — matches BlueprintOnboarding exactly
// ---------------------------------------------------------------------------
type Direction = "forward" | "back";

function motionProfileFor(stepId: string) {
  if (stepId === "welcome" || stepId === "source") {
    return { stiffness: 520, damping: 34, mass: 0.7, exitDuration: 0.42 };
  }
  if (stepId === "review" || stepId === "finish") {
    return { stiffness: 260, damping: 42, mass: 1.1, exitDuration: 0.55 };
  }
  return { stiffness: 360, damping: 36, mass: 0.9, exitDuration: 0.48 };
}

// ---------------------------------------------------------------------------
// Nav bar styles — inline so they're independent of Tailwind/blueprint.css
// ---------------------------------------------------------------------------
const NAV: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 100,
  background: "#0d0a00",
  borderBottom: "1px solid #78350f",
  padding: "8px 16px",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
  fontFamily: "'Courier New', monospace",
  fontSize: "12px",
  lineHeight: "1.4",
};

const BTN: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #78350f",
  color: "#d97706",
  fontFamily: "'Courier New', monospace",
  fontSize: "12px",
  padding: "3px 8px",
  borderRadius: "3px",
  cursor: "pointer",
};

const SELECT: React.CSSProperties = {
  background: "#0d0a00",
  border: "1px solid #78350f",
  color: "#d97706",
  fontFamily: "'Courier New', monospace",
  fontSize: "12px",
  padding: "3px 6px",
  borderRadius: "3px",
  maxWidth: "220px",
};

// ---------------------------------------------------------------------------

type Props = {
  initialStep: string;
};

export default function PreviewShell({ initialStep }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL is the source of truth for the current step.
  const stepIdFromUrl = searchParams.get("step") ?? initialStep;
  const currentStepId = ONBOARDING_STEPS.some((s) => s.id === stepIdFromUrl)
    ? stepIdFromUrl
    : "welcome";

  const [direction, setDirection] = useState<Direction>("forward");

  const stepIndex = useMemo(
    () => ONBOARDING_STEPS.findIndex((s) => s.id === currentStepId),
    [currentStepId]
  );

  const currentStep = ONBOARDING_STEPS[stepIndex] as OnboardingStep;
  const progress =
    ONBOARDING_STEPS.length > 0
      ? ((stepIndex + 1) / ONBOARDING_STEPS.length) * 100
      : 0;

  function navigateTo(stepId: string, dir: Direction = "forward") {
    setDirection(dir);
    router.replace(`/onboarding/preview?step=${stepId}`, { scroll: false });
  }

  const goBack = () => {
    const prev = ONBOARDING_STEPS[stepIndex - 1];
    if (prev) navigateTo(prev.id, "back");
  };

  const goForward = () => {
    const next = ONBOARDING_STEPS[stepIndex + 1];
    if (next) navigateTo(next.id, "forward");
  };

  const profile = motionProfileFor(currentStep.id);

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
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* ------------------------------------------------------------------ */}
      {/* DEV PREVIEW NAVIGATOR                                               */}
      {/* Visually separate from the onboarding UI.                          */}
      {/* Does not affect the width or layout of the onboarding content.     */}
      {/* ------------------------------------------------------------------ */}
      <nav style={NAV} aria-label="Dev preview step navigator">
        <span style={{ color: "#d97706", fontWeight: "bold", whiteSpace: "nowrap" }}>
          ⚠ DEV PREVIEW
        </span>

        <button
          style={BTN}
          disabled={stepIndex === 0}
          onClick={() => navigateTo(ONBOARDING_STEPS[stepIndex - 1]?.id ?? "welcome", "back")}
        >
          ← Prev
        </button>

        <select
          style={SELECT}
          value={currentStepId}
          onChange={(e) => navigateTo(e.target.value)}
          aria-label="Jump to step"
        >
          {ONBOARDING_STEPS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.number} — {s.title}
            </option>
          ))}
        </select>

        <button
          style={BTN}
          disabled={stepIndex === ONBOARDING_STEPS.length - 1}
          onClick={() => navigateTo(ONBOARDING_STEPS[stepIndex + 1]?.id ?? "finish", "forward")}
        >
          Next →
        </button>

        <span style={{ color: "#6b7280", marginLeft: "auto", whiteSpace: "nowrap" }}>
          {stepIndex + 1}/{ONBOARDING_STEPS.length}
        </span>
      </nav>

      {/* ------------------------------------------------------------------ */}
      {/* REAL ONBOARDING CONTENT                                             */}
      {/* Mirrors app/onboarding/layout.tsx + BlueprintOnboarding markup.   */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex-1 flex items-start sm:items-center justify-center px-4 sm:px-6 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:py-12">
        <div className="w-full max-w-2xl">
          <div className="onboarding-container">
            <div
              className="progress-bar-wrapper"
              role="progressbar"
              aria-label="Onboarding progress"
              aria-valuemin={1}
              aria-valuemax={ONBOARDING_STEPS.length}
              aria-valuenow={stepIndex + 1}
              aria-valuetext={`Step ${stepIndex + 1} of ${ONBOARDING_STEPS.length}`}
            >
              <div className="progress-bar" style={{ width: `${progress}%` }} />
            </div>

            <MotionConfig reducedMotion="user">
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
                    context={PREVIEW_CONTEXT}
                    isFirst={stepIndex === 0}
                    isLast={stepIndex === ONBOARDING_STEPS.length - 1}
                    onBack={goBack}
                    onForwardStart={goForward}
                    renderStep={
                      currentStep.type === "finish"
                        ? () => <PreviewFinishStep />
                        : undefined
                    }
                  />
                </motion.div>
              </AnimatePresence>
            </MotionConfig>
          </div>
        </div>
      </main>
    </div>
  );
}
