"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Brain,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Layers3,
  Loader2,
  RotateCcw,
  Sparkles,
  Target,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  contentStrategyPlatforms,
  generateMockContentStrategy,
  validateContentStrategyInput,
  type ContentStrategyInput,
  type ContentStrategyPlatform,
  type GeneratedContentStrategy,
} from "@/lib/strategy/content-strategy";

const initialInput: ContentStrategyInput = {
  businessNiche: "",
  targetAudience: "",
  contentGoals: "",
  offerProduct: "",
  preferredPlatforms: ["LinkedIn", "Newsletter"],
  toneBrandStyle: "",
};

const fieldClass =
  "border-blueprint-cyan/20 bg-background/40 focus-visible:border-blueprint-cyan focus-visible:ring-blueprint-cyan/20";

const requiredFields: Array<
  keyof Omit<ContentStrategyInput, "preferredPlatforms">
> = [
  "businessNiche",
  "targetAudience",
  "contentGoals",
  "offerProduct",
  "toneBrandStyle",
];

export function ContentStrategyStudio() {
  const [input, setInput] = useState<ContentStrategyInput>(initialInput);
  const [strategy, setStrategy] = useState<GeneratedContentStrategy | null>(
    null
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const completionCount = useMemo(() => {
    const completedTextFields = requiredFields.filter(
      (field) => input[field].trim().length > 0
    ).length;

    return completedTextFields + (input.preferredPlatforms.length > 0 ? 1 : 0);
  }, [input]);

  const readiness = Math.round((completionCount / 6) * 100);
  const validation = useMemo(() => validateContentStrategyInput(input), [input]);

  function updateInput(field: keyof ContentStrategyInput, value: string) {
    setInput((current) => ({ ...current, [field]: value }));
  }

  function togglePlatform(platform: ContentStrategyPlatform, checked: boolean) {
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
      setError(
        validation.message ??
          "Complete each strategy input and select at least one platform before generating."
      );
      return;
    }

    setIsGenerating(true);
    setStrategy(null);

    try {
      const generated = await generateMockContentStrategy(input);
      setStrategy(generated);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Strategy generation failed. Try again in a moment.";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleReset() {
    setInput(initialInput);
    setStrategy(null);
    setError(null);
    setHasSubmitted(false);
    setIsGenerating(false);
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="relative overflow-hidden rounded-xl border border-blueprint-cyan/20 bg-blueprint-panel/75 p-5 shadow-card backdrop-blur-md sm:p-6 lg:p-8">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blueprint-cyan/70 to-transparent" />
        <div className="absolute right-4 top-4 hidden h-20 w-20 border-r border-t border-blueprint-cyan/25 lg:block" />
        <div className="relative grid gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blueprint-cyan/25 bg-blueprint-cyan/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-blueprint-cyan">
              <Brain className="h-3.5 w-3.5" />
              Content Strategy Studio
            </div>
            <div className="max-w-3xl space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                Shape the content system behind your next growth move.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Convert audience, offer, voice, and channel inputs into a
                strategy that is ready for campaigns, publishing, and founder-led
                execution.
              </p>
            </div>
          </div>
          <Card className="border-blueprint-cyan/20 bg-background/35 shadow-none">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-blueprint-cyan/80">
                    Brief readiness
                  </p>
                  <p className="mt-1 text-3xl font-semibold text-foreground">
                    {readiness}%
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blueprint-cyan/10 text-blueprint-cyan">
                  <Target className="h-5 w-5" />
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-blueprint-cyan/10">
                <div
                  className="h-full rounded-full bg-blueprint-cyan transition-all"
                  style={{ width: `${readiness}%` }}
                />
              </div>
              <p className="text-sm leading-5 text-muted-foreground">
                Complete the strategic inputs to generate pillars, angles,
                cadence, and next actions.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card className="border-blueprint-cyan/20 bg-blueprint-panel/70 shadow-card backdrop-blur-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="h-5 w-5 text-blueprint-cyan" />
                Strategy inputs
              </CardTitle>
              <CardDescription>
                Capture the positioning context the strategy should be built
                around.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border border-blueprint-cyan/15 bg-background/30 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blueprint-cyan/10 text-blueprint-cyan">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {validation.isValid
                        ? "Brief ready for generation"
                        : "Build the strategy brief"}
                    </p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {validation.isValid
                        ? "All required context is captured."
                        : `${validation.missingFields.length} required input${
                            validation.missingFields.length === 1 ? "" : "s"
                          } remaining.`}
                    </p>
                  </div>
                </div>
              </div>

              <Field
                label="Business / niche"
                required
                invalid={hasSubmitted && input.businessNiche.trim().length === 0}
              >
                <Input
                  className={fieldClass}
                  value={input.businessNiche}
                  onChange={(event) =>
                    updateInput("businessNiche", event.target.value)
                  }
                  placeholder="Example: B2B founder coaching for service businesses"
                />
              </Field>

              <Field
                label="Target audience"
                required
                invalid={hasSubmitted && input.targetAudience.trim().length === 0}
              >
                <Textarea
                  className={fieldClass}
                  value={input.targetAudience}
                  onChange={(event) =>
                    updateInput("targetAudience", event.target.value)
                  }
                  placeholder="Who needs this strategy, what they care about, and what pressure they are under."
                />
              </Field>

              <Field
                label="Content goals"
                required
                invalid={hasSubmitted && input.contentGoals.trim().length === 0}
              >
                <Textarea
                  className={fieldClass}
                  value={input.contentGoals}
                  onChange={(event) =>
                    updateInput("contentGoals", event.target.value)
                  }
                  placeholder="Build authority, generate qualified calls, support a launch, nurture leads..."
                />
              </Field>

              <Field
                label="Offer / product"
                required
                invalid={hasSubmitted && input.offerProduct.trim().length === 0}
              >
                <Input
                  className={fieldClass}
                  value={input.offerProduct}
                  onChange={(event) =>
                    updateInput("offerProduct", event.target.value)
                  }
                  placeholder="Example: 8-week growth strategy sprint"
                />
              </Field>

              <Field
                label="Preferred platforms"
                required
                invalid={hasSubmitted && input.preferredPlatforms.length === 0}
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  {contentStrategyPlatforms.map((platform) => (
                    <label
                      key={platform}
                      className="flex items-center gap-3 rounded-lg border border-blueprint-cyan/15 bg-background/35 p-3 text-sm text-foreground"
                    >
                      <Checkbox
                        checked={input.preferredPlatforms.includes(platform)}
                        onCheckedChange={(checked) =>
                          togglePlatform(platform, checked === true)
                        }
                      />
                      {platform}
                    </label>
                  ))}
                </div>
              </Field>

              <Field
                label="Tone / brand style"
                required
                invalid={hasSubmitted && input.toneBrandStyle.trim().length === 0}
              >
                <Textarea
                  className={fieldClass}
                  value={input.toneBrandStyle}
                  onChange={(event) =>
                    updateInput("toneBrandStyle", event.target.value)
                  }
                  placeholder="Strategic, direct, premium, founder-led, clear, opinionated..."
                />
              </Field>

              {error ? (
                <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="submit"
                  className="h-11 bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Building strategy
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
                  className="h-11 border-blueprint-cyan/25 bg-blueprint-panel/60 text-foreground hover:bg-blueprint-cyan/10"
                  onClick={handleReset}
                  disabled={isGenerating}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>

        <StrategyOutput
          strategy={strategy}
          isGenerating={isGenerating}
          hasSubmitted={hasSubmitted}
          error={error}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  invalid,
  children,
}: {
  label: string;
  required?: boolean;
  invalid?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="block space-y-2">
      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
        {label}
        {required ? (
          <span className="text-xs font-normal text-blueprint-cyan">
            Required
          </span>
        ) : null}
        {invalid ? (
          <span className="text-xs font-normal text-destructive">
            Needed
          </span>
        ) : null}
      </span>
      {children}
    </div>
  );
}

function StrategyOutput({
  strategy,
  isGenerating,
  hasSubmitted,
  error,
}: {
  strategy: GeneratedContentStrategy | null;
  isGenerating: boolean;
  hasSubmitted: boolean;
  error: string | null;
}) {
  if (isGenerating) {
    return (
      <Card className="min-h-[640px] border-blueprint-cyan/20 bg-blueprint-panel/70 shadow-card backdrop-blur-md">
        <CardContent className="flex h-full min-h-[640px] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-blueprint-cyan/10 text-blueprint-cyan">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              Building your strategy system
            </h2>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              Architecta is translating your brief into pillars, audience
              angles, themes, cadence, recommendations, and execution steps.
            </p>
          </div>
          <div className="grid w-full max-w-lg gap-3 text-left">
            {[
              "Mapping content pillars",
              "Translating audience angles",
              "Prioritizing cadence and next actions",
            ].map((item) => (
              <div
                key={item}
                className="rounded-lg border border-blueprint-cyan/10 bg-background/35 p-4"
              >
                <div className="mb-3 h-3 w-2/3 animate-pulse rounded-full bg-blueprint-cyan/20" />
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-blueprint-cyan/70">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (strategy) {
    return (
      <div className="space-y-4">
        <Card className="border-blueprint-cyan/20 bg-blueprint-panel/70 shadow-card backdrop-blur-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <CheckCircle2 className="h-5 w-5 text-blueprint-cyan" />
              Generated strategy
            </CardTitle>
            <CardDescription>{strategy.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                "Strategic pillars",
                "Channel cadence",
                "Execution queue",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-lg border border-blueprint-cyan/15 bg-background/30 p-3"
                >
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-blueprint-cyan/70">
                    Ready
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {item}
                  </p>
                </div>
              ))}
            </div>
            <SectionGrid
              icon={Layers3}
              title="Content pillars"
              sections={strategy.contentPillars}
            />
            <ListSection
              icon={Target}
              title="Audience angles"
              items={strategy.audienceAngles}
            />
            <ListSection
              icon={Sparkles}
              title="Content themes"
              items={strategy.contentThemes}
            />
            <ListSection
              icon={CalendarClock}
              title="Posting cadence"
              items={strategy.postingCadence}
            />
            <ListSection
              icon={Zap}
              title="Quick-win recommendations"
              items={strategy.quickWins}
            />
            <ListSection
              icon={ArrowRight}
              title="Next actions"
              items={strategy.nextActions}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && hasSubmitted) {
    return (
      <Card className="min-h-[640px] border-destructive/30 bg-blueprint-panel/70 shadow-card backdrop-blur-md">
        <CardContent className="flex h-full min-h-[640px] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              Strategy brief needs attention
            </h2>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              {error}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-h-[640px] border-blueprint-cyan/20 bg-blueprint-panel/70 shadow-card backdrop-blur-md">
      <CardContent className="flex h-full min-h-[640px] flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-blueprint-cyan/10 text-blueprint-cyan">
          <Layers3 className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">
            Your strategy output will appear here
          </h2>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            Start with the brief on the left. Once generated, this space becomes
            the operating plan for pillars, angles, cadence, quick wins, and
            next actions.
          </p>
        </div>
        <div className="grid w-full max-w-lg gap-3 text-left">
          {["Content pillars", "Audience angles", "Posting cadence"].map(
            (item) => (
              <div
                key={item}
                className="flex items-center justify-between rounded-lg border border-blueprint-cyan/15 bg-background/35 p-4"
              >
                <span className="text-sm font-medium text-foreground">
                  {item}
                </span>
                <Badge
                  variant="outline"
                  className="border-blueprint-cyan/20 text-blueprint-cyan"
                >
                  Pending
                </Badge>
              </div>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SectionGrid({
  icon: Icon,
  title,
  sections,
}: {
  icon: LucideIcon;
  title: string;
  sections: GeneratedContentStrategy["contentPillars"];
}) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-blueprint-cyan/80">
        <Icon className="h-4 w-4" />
        {title}
      </h3>
      <div className="grid gap-3 lg:grid-cols-3">
        {sections.map((section) => (
          <div
            key={section.title}
            className="rounded-lg border border-blueprint-cyan/15 bg-background/35 p-4"
          >
            <h4 className="font-semibold text-foreground">{section.title}</h4>
            <ul className="mt-3 space-y-2">
              {section.items.map((item) => (
                <li
                  key={item}
                  className="text-sm leading-5 text-muted-foreground"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function ListSection({
  icon: Icon,
  title,
  items,
}: {
  icon: LucideIcon;
  title: string;
  items: string[];
}) {
  return (
    <section className="space-y-3 rounded-lg border border-blueprint-cyan/15 bg-background/25 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-blueprint-cyan/80">
        <Icon className="h-4 w-4" />
        {title}
      </h3>
      <div className="grid gap-2">
        {items.map((item) => (
          <div key={item} className="flex gap-3 text-sm leading-5">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blueprint-cyan" />
            <span className="text-muted-foreground">{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
