"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Layers3,
  Loader2,
  RefreshCcw,
  Rocket,
  Sparkles,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  generateStrategyEnginePlan,
  strategyEnginePlatforms,
  validateStrategyEngineInput,
  type GeneratedStrategyEnginePlan,
  type StrategyEngineInput,
  type StrategyEnginePlatform,
} from "@/lib/strategy/strategy-engine";

const initialInput: StrategyEngineInput = {
  businessNiche: "",
  audience: "",
  offer: "",
  primaryGoal: "",
  currentChallenge: "",
  preferredPlatforms: ["LinkedIn", "Newsletter"],
};

const inputClass =
  "border-white/10 bg-[#041C3B]/50 text-white placeholder:text-[#BCC0D8]/45 focus-visible:border-[#00D4FF]/70 focus-visible:ring-[#00D4FF]/20";

const requiredTextFields: Array<Exclude<keyof StrategyEngineInput, "preferredPlatforms">> = [
  "businessNiche",
  "audience",
  "offer",
  "primaryGoal",
  "currentChallenge",
];

export function StrategyEngineWorkflow() {
  const [input, setInput] = useState<StrategyEngineInput>(initialInput);
  const [plan, setPlan] = useState<GeneratedStrategyEnginePlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const validation = useMemo(() => validateStrategyEngineInput(input), [input]);
  const completionCount = useMemo(() => {
    const textCount = requiredTextFields.filter((field) => input[field].trim().length > 0).length;
    return textCount + (input.preferredPlatforms.length > 0 ? 1 : 0);
  }, [input]);
  const readiness = Math.round((completionCount / 6) * 100);

  function updateInput(field: Exclude<keyof StrategyEngineInput, "preferredPlatforms">, value: string) {
    setInput((current) => ({ ...current, [field]: value }));
  }

  function togglePlatform(platform: StrategyEnginePlatform, checked: boolean) {
    setInput((current) => {
      const preferredPlatforms = checked
        ? [...current.preferredPlatforms, platform]
        : current.preferredPlatforms.filter((item) => item !== platform);

      return { ...current, preferredPlatforms };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasSubmitted(true);
    setError(null);

    if (!validation.isValid) {
      setPlan(null);
      setError(validation.message ?? "Complete the strategy brief before generating.");
      return;
    }

    setIsGenerating(true);
    setPlan(null);

    try {
      const generatedPlan = await generateStrategyEnginePlan(input);
      setPlan(generatedPlan);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Strategy generation failed. Try again in a moment.";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleReset() {
    setInput(initialInput);
    setPlan(null);
    setError(null);
    setHasSubmitted(false);
    setIsGenerating(false);
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0B2B57]/40 p-6 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] backdrop-blur-xl lg:p-8">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00D4FF]/70 to-transparent" />
        <div className="relative grid gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
          <div className="space-y-4">
            <p className="font-mono text-xs uppercase tracking-widest text-[#00D4FF]">
              Strategy Engine
            </p>
            <div className="max-w-3xl space-y-3">
              <h1 className="font-[var(--font-science-gothic,var(--font-inter))] text-4xl font-bold tracking-tight text-white md:text-5xl">
                Architect a growth strategy from offer to execution.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-[#BCC0D8] md:text-base">
                Turn business context, audience pressure, platform focus, and current bottlenecks into a structured content and growth operating plan.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[#00D4FF]/20 bg-[#041C3B]/45 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00D4FF]">Brief readiness</p>
                <p className="mt-2 text-4xl font-bold text-white">{readiness}%</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#00D4FF]/10 text-[#00D4FF]">
                <Target className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#00D4FF] transition-all" style={{ width: `${readiness}%` }} />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-[#0B2B57]/40 p-5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] backdrop-blur-xl lg:p-6">
          <div className="mb-6 flex items-start gap-3">
            <div className="rounded-lg bg-[#00D4FF]/10 p-2 text-[#00D4FF]">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-[var(--font-science-gothic,var(--font-inter))] text-xl font-semibold text-white">
                Strategy brief
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#BCC0D8]">
                Capture the inputs Architecta needs to shape the growth system.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <Field label="Business / niche" invalid={hasSubmitted && input.businessNiche.trim().length === 0}>
              <Input
                className={inputClass}
                value={input.businessNiche}
                onChange={(event) => updateInput("businessNiche", event.target.value)}
                placeholder="Example: premium operations advisory for solo founders"
              />
            </Field>

            <Field label="Audience" invalid={hasSubmitted && input.audience.trim().length === 0}>
              <Textarea
                className={inputClass}
                value={input.audience}
                onChange={(event) => updateInput("audience", event.target.value)}
                placeholder="Who you serve, what they want, and what pressure they are under."
              />
            </Field>

            <Field label="Offer" invalid={hasSubmitted && input.offer.trim().length === 0}>
              <Input
                className={inputClass}
                value={input.offer}
                onChange={(event) => updateInput("offer", event.target.value)}
                placeholder="Example: 6-week growth systems sprint"
              />
            </Field>

            <Field label="Primary goal" invalid={hasSubmitted && input.primaryGoal.trim().length === 0}>
              <Input
                className={inputClass}
                value={input.primaryGoal}
                onChange={(event) => updateInput("primaryGoal", event.target.value)}
                placeholder="Example: generate qualified sales calls"
              />
            </Field>

            <Field label="Current challenge" invalid={hasSubmitted && input.currentChallenge.trim().length === 0}>
              <Textarea
                className={inputClass}
                value={input.currentChallenge}
                onChange={(event) => updateInput("currentChallenge", event.target.value)}
                placeholder="What is slowing growth, weakening content, or blocking conversion right now?"
              />
            </Field>

            <Field label="Preferred platforms" invalid={hasSubmitted && input.preferredPlatforms.length === 0}>
              <div className="grid gap-2 sm:grid-cols-2">
                {strategyEnginePlatforms.map((platform) => (
                  <label
                    key={platform}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#041C3B]/45 p-3 text-sm text-white"
                  >
                    <Checkbox
                      checked={input.preferredPlatforms.includes(platform)}
                      onCheckedChange={(checked) => togglePlatform(platform, checked === true)}
                      className="border-[#00D4FF]/35 data-[state=checked]:border-[#00D4FF] data-[state=checked]:bg-[#00D4FF] data-[state=checked]:text-[#041C3B]"
                    />
                    {platform}
                  </label>
                ))}
              </div>
            </Field>

            {error ? (
              <div className="flex gap-3 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit" className="h-11 rounded-lg bg-[#087EFF] px-5 text-white hover:bg-[#087EFF]/90" disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating
                  </>
                ) : (
                  <>
                    Generate strategy
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-lg border-white/10 bg-[#041C3B]/40 px-5 text-white hover:bg-white/5 hover:text-white"
                onClick={handleReset}
                disabled={isGenerating}
              >
                <RefreshCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        </form>

        <StrategyResult plan={plan} isGenerating={isGenerating} hasSubmitted={hasSubmitted} error={error} />
      </div>
    </div>
  );
}

function Field({
  label,
  invalid,
  children,
}: {
  label: string;
  invalid: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center gap-2 text-sm font-medium text-white">
        {label}
        <span className="text-xs font-normal text-[#00D4FF]">Required</span>
        {invalid ? <span className="text-xs font-normal text-red-200">Needed</span> : null}
      </span>
      {children}
    </label>
  );
}

function StrategyResult({
  plan,
  isGenerating,
  hasSubmitted,
  error,
}: {
  plan: GeneratedStrategyEnginePlan | null;
  isGenerating: boolean;
  hasSubmitted: boolean;
  error: string | null;
}) {
  if (isGenerating) {
    return (
      <StatePanel icon={Loader2} title="Building the growth system" iconClassName="animate-spin">
        <p className="max-w-md text-sm leading-6 text-[#BCC0D8]">
          Architecta is mapping the strategic summary, content pillars, growth priorities, next moves, and 30-day focus.
        </p>
        <div className="mt-6 grid w-full max-w-xl gap-3 text-left">
          {["Strategic summary", "Content pillars", "30-day focus"].map((item) => (
            <div key={item} className="rounded-xl border border-white/10 bg-[#041C3B]/45 p-4">
              <div className="mb-3 h-3 w-2/3 animate-pulse rounded-full bg-[#00D4FF]/20" />
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00D4FF]/80">{item}</p>
            </div>
          ))}
        </div>
      </StatePanel>
    );
  }

  if (plan) {
    return (
      <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0B2B57]/40 p-5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] backdrop-blur-xl lg:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-[#00D4FF]/10 p-2 text-[#00D4FF]">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-[var(--font-science-gothic,var(--font-inter))] text-xl font-semibold text-white">
              Generated strategy
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#BCC0D8]">{plan.strategicSummary}</p>
          </div>
        </div>

        <PillarSection title="Content pillars" icon={Layers3} pillars={plan.contentPillars} />
        <ListSection title="Growth priorities" icon={Target} items={plan.growthPriorities} />
        <ListSection title="Recommended next moves" icon={Rocket} items={plan.recommendedNextMoves} />
        <ListSection title="30-day focus" icon={Zap} items={plan.thirtyDayFocus} />
      </div>
    );
  }

  if (error && hasSubmitted) {
    return (
      <StatePanel icon={AlertCircle} title="Strategy brief needs attention" tone="error">
        <p className="max-w-md text-sm leading-6 text-[#BCC0D8]">{error}</p>
      </StatePanel>
    );
  }

  return (
    <StatePanel icon={Sparkles} title="Your strategy output will appear here">
      <p className="max-w-md text-sm leading-6 text-[#BCC0D8]">
        Complete the brief to generate a strategic summary, content pillars, growth priorities, recommended next moves, and a 30-day execution focus.
      </p>
    </StatePanel>
  );
}

function StatePanel({
  icon: Icon,
  title,
  children,
  tone = "default",
  iconClassName,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  tone?: "default" | "error";
  iconClassName?: string;
}) {
  return (
    <div className="flex min-h-[620px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#0B2B57]/40 p-8 text-center shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-xl ${tone === "error" ? "bg-red-500/10 text-red-200" : "bg-[#00D4FF]/10 text-[#00D4FF]"}`}>
        <Icon className={`h-7 w-7 ${iconClassName ?? ""}`} />
      </div>
      <h2 className="font-[var(--font-science-gothic,var(--font-inter))] text-xl font-semibold text-white">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function PillarSection({
  title,
  icon: Icon,
  pillars,
}: {
  title: string;
  icon: LucideIcon;
  pillars: GeneratedStrategyEnginePlan["contentPillars"];
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-[#041C3B]/35 p-4">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#00D4FF]">
        <Icon className="h-4 w-4" />
        {title}
      </h3>
      <div className="grid gap-3 lg:grid-cols-3">
        {pillars.map((pillar) => (
          <div key={pillar.title} className="rounded-xl border border-white/10 bg-[#0B2B57]/35 p-4">
            <h4 className="font-semibold text-white">{pillar.title}</h4>
            <p className="mt-2 text-sm leading-5 text-[#BCC0D8]">{pillar.description}</p>
            <ul className="mt-3 space-y-2">
              {pillar.moves.map((move) => (
                <li key={move} className="text-sm leading-5 text-[#BCC0D8]">
                  {move}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function ListSection({ title, icon: Icon, items }: { title: string; icon: LucideIcon; items: string[] }) {
  return (
    <section className="space-y-3 rounded-2xl border border-white/10 bg-[#041C3B]/35 p-4">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#00D4FF]">
        <Icon className="h-4 w-4" />
        {title}
      </h3>
      <div className="grid gap-2">
        {items.map((item) => (
          <div key={item} className="flex gap-3 text-sm leading-5 text-[#BCC0D8]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00D4FF]" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
