"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clipboard,
  ClipboardCheck,
  FileText,
  Layers3,
  Lightbulb,
  Loader2,
  Megaphone,
  RefreshCcw,
  Repeat2,
  Sparkles,
  Target,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  contentArchitectPlatforms,
  generateContentArchitectPlan,
  validateContentArchitectInput,
  type ContentArchitectInput,
  type ContentArchitectPlatform,
  type ContentArchitectSection,
  type GeneratedContentArchitectPlan,
} from "@/lib/strategy/content-architect";

const initialInput: ContentArchitectInput = {
  strategySummary: "",
  audience: "",
  contentGoal: "",
  platform: "LinkedIn",
  tone: "",
  offerProduct: "",
};

const requiredFields: Array<keyof ContentArchitectInput> = [
  "strategySummary",
  "audience",
  "contentGoal",
  "platform",
  "tone",
  "offerProduct",
];

const fieldClass =
  "border-blueprint-cyan/20 bg-background/40 focus-visible:border-blueprint-cyan focus-visible:ring-blueprint-cyan/20";

function sectionText(title: string, items: string[]) {
  return [title, ...items.map((item) => `- ${item}`)].join("\n");
}

function planText(plan: GeneratedContentArchitectPlan) {
  const sections = [
    `Summary\n${plan.summary}`,
    ...plan.contentPillars.map((section) =>
      sectionText(`Content Pillar: ${section.title}`, section.items)
    ),
    ...plan.weeklyThemes.map((section) =>
      sectionText(`Weekly Theme: ${section.title}`, section.items)
    ),
    ...plan.postIdeas.map((section) =>
      sectionText(`Post Ideas: ${section.title}`, section.items)
    ),
    sectionText("Content Formats", plan.contentFormats),
    sectionText("Repurposing Ideas", plan.repurposingIdeas),
  ];

  return sections.join("\n\n");
}

export function ContentArchitectStudio() {
  const [input, setInput] = useState<ContentArchitectInput>(initialInput);
  const [plan, setPlan] = useState<GeneratedContentArchitectPlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const validation = useMemo(
    () => validateContentArchitectInput(input),
    [input]
  );

  const readiness = useMemo(() => {
    const completedFields = requiredFields.filter(
      (field) => input[field].trim().length > 0
    ).length;

    return Math.round((completedFields / requiredFields.length) * 100);
  }, [input]);

  function updateInput(field: keyof ContentArchitectInput, value: string) {
    setInput((current) => ({ ...current, [field]: value }));
  }

  async function copyText(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1600);
    } catch {
      setError("Copy failed. Select the generated text and copy it manually.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasSubmitted(true);
    setError(null);
    setCopiedKey(null);

    if (!validation.isValid) {
      setError(
        validation.message ??
          "Complete each content architect input before generating."
      );
      return;
    }

    setIsGenerating(true);
    setPlan(null);

    try {
      const generated = await generateContentArchitectPlan(input);
      setPlan(generated);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Content plan generation failed. Try again in a moment.";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleReset() {
    setInput(initialInput);
    setPlan(null);
    setIsGenerating(false);
    setError(null);
    setHasSubmitted(false);
    setCopiedKey(null);
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="relative overflow-hidden rounded-xl border border-blueprint-cyan/20 bg-blueprint-panel/75 p-5 shadow-card backdrop-blur-md sm:p-6 lg:p-8">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blueprint-cyan/70 to-transparent" />
        <div className="absolute right-4 top-4 hidden h-20 w-20 border-r border-t border-blueprint-cyan/25 lg:block" />
        <div className="relative grid gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-blueprint-cyan/25 bg-blueprint-cyan/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-blueprint-cyan">
              <Layers3 className="h-3.5 w-3.5" />
              Content Architect
            </div>
            <div className="max-w-3xl space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                Turn strategy into content plans and publishable ideas.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Translate a strategic direction into pillars, weekly themes,
                post ideas, formats, and repurposing paths built for founder-led
                execution.
              </p>
            </div>
          </div>
          <Card className="border-blueprint-cyan/20 bg-background/35 shadow-none">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-blueprint-cyan/80">
                    Plan readiness
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
                Complete the brief to generate a structured content architecture
                for the selected channel.
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
                Strategy-to-content inputs
              </CardTitle>
              <CardDescription>
                Capture the strategic context the content plan should execute.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border border-blueprint-cyan/15 bg-background/30 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blueprint-cyan/10 text-blueprint-cyan">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {validation.isValid
                        ? "Brief ready for generation"
                        : "Build the content architecture brief"}
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
                label="Strategy summary"
                required
                invalid={
                  hasSubmitted && input.strategySummary.trim().length === 0
                }
              >
                <Textarea
                  className={fieldClass}
                  value={input.strategySummary}
                  onChange={(event) =>
                    updateInput("strategySummary", event.target.value)
                  }
                  placeholder="Summarize the strategic direction, key insight, campaign focus, or growth thesis."
                />
              </Field>

              <Field
                label="Audience"
                required
                invalid={hasSubmitted && input.audience.trim().length === 0}
              >
                <Textarea
                  className={fieldClass}
                  value={input.audience}
                  onChange={(event) =>
                    updateInput("audience", event.target.value)
                  }
                  placeholder="Who this content needs to move, what they care about, and what pressure they feel."
                />
              </Field>

              <Field
                label="Content goal"
                required
                invalid={hasSubmitted && input.contentGoal.trim().length === 0}
              >
                <Input
                  className={fieldClass}
                  value={input.contentGoal}
                  onChange={(event) =>
                    updateInput("contentGoal", event.target.value)
                  }
                  placeholder="Example: generate qualified consult calls"
                />
              </Field>

              <Field
                label="Platform"
                required
                invalid={hasSubmitted && input.platform.trim().length === 0}
              >
                <Select
                  value={input.platform}
                  onValueChange={(value: ContentArchitectPlatform) =>
                    updateInput("platform", value)
                  }
                >
                  <SelectTrigger className={fieldClass}>
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {contentArchitectPlatforms.map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        {platform}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Tone"
                required
                invalid={hasSubmitted && input.tone.trim().length === 0}
              >
                <Input
                  className={fieldClass}
                  value={input.tone}
                  onChange={(event) => updateInput("tone", event.target.value)}
                  placeholder="Example: strategic, concise, premium, founder-led"
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
                  placeholder="Example: 90-day content operating system"
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
                      Building plan
                    </>
                  ) : (
                    <>
                      Generate content plan
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
                  <RefreshCcw className="h-4 w-4" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>

        <ContentArchitectOutput
          plan={plan}
          isGenerating={isGenerating}
          hasSubmitted={hasSubmitted}
          error={error}
          copiedKey={copiedKey}
          onCopy={copyText}
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
          <span className="text-xs font-normal text-destructive">Needed</span>
        ) : null}
      </span>
      {children}
    </div>
  );
}

function ContentArchitectOutput({
  plan,
  isGenerating,
  hasSubmitted,
  error,
  copiedKey,
  onCopy,
}: {
  plan: GeneratedContentArchitectPlan | null;
  isGenerating: boolean;
  hasSubmitted: boolean;
  error: string | null;
  copiedKey: string | null;
  onCopy: (key: string, value: string) => void;
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
              Architecting your content plan
            </h2>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              Architecta is translating the strategy into pillars, themes,
              ideas, formats, and repurposing paths.
            </p>
          </div>
          <div className="grid w-full max-w-lg gap-3 text-left">
            {[
              "Mapping strategic pillars",
              "Sequencing weekly themes",
              "Drafting repurposing paths",
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

  if (plan) {
    return (
      <Card className="border-blueprint-cyan/20 bg-blueprint-panel/70 shadow-card backdrop-blur-md">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <CheckCircle2 className="h-5 w-5 text-blueprint-cyan" />
                Generated content architecture
              </CardTitle>
              <CardDescription className="mt-2">{plan.summary}</CardDescription>
            </div>
            <CopyButton
              label="Copy plan"
              copied={copiedKey === "full-plan"}
              onClick={() => onCopy("full-plan", planText(plan))}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {["Pillars", "Themes", "Ideas"].map((item) => (
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
            sections={plan.contentPillars}
            copiedKey={copiedKey}
            copyPrefix="pillar"
            onCopy={onCopy}
          />
          <SectionGrid
            icon={Target}
            title="Weekly themes"
            sections={plan.weeklyThemes}
            copiedKey={copiedKey}
            copyPrefix="theme"
            onCopy={onCopy}
          />
          <SectionGrid
            icon={Lightbulb}
            title="Post ideas"
            sections={plan.postIdeas}
            copiedKey={copiedKey}
            copyPrefix="idea"
            onCopy={onCopy}
          />
          <ListSection
            icon={Megaphone}
            title="Content formats"
            items={plan.contentFormats}
            copied={copiedKey === "formats"}
            onCopy={() =>
              onCopy("formats", sectionText("Content Formats", plan.contentFormats))
            }
          />
          <ListSection
            icon={Repeat2}
            title="Repurposing ideas"
            items={plan.repurposingIdeas}
            copied={copiedKey === "repurposing"}
            onCopy={() =>
              onCopy(
                "repurposing",
                sectionText("Repurposing Ideas", plan.repurposingIdeas)
              )
            }
          />
        </CardContent>
      </Card>
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
              Content brief needs attention
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
            Your content plan will appear here
          </h2>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            Start with the strategic brief on the left. Once generated, this
            space becomes the operating plan for content pillars, weekly themes,
            post ideas, formats, and repurposing.
          </p>
        </div>
        <div className="grid w-full max-w-lg gap-3 text-left">
          {[
            "Content pillars",
            "Weekly themes",
            "Post ideas",
            "Repurposing ideas",
          ].map((item) => (
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
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SectionGrid({
  icon: Icon,
  title,
  sections,
  copiedKey,
  copyPrefix,
  onCopy,
}: {
  icon: LucideIcon;
  title: string;
  sections: ContentArchitectSection[];
  copiedKey: string | null;
  copyPrefix: string;
  onCopy: (key: string, value: string) => void;
}) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-blueprint-cyan/80">
        <Icon className="h-4 w-4" />
        {title}
      </h3>
      <div className="grid gap-3 lg:grid-cols-3">
        {sections.map((section) => {
          const copyKey = `${copyPrefix}-${section.title}`;

          return (
            <div
              key={section.title}
              className="rounded-lg border border-blueprint-cyan/15 bg-background/35 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <h4 className="font-semibold text-foreground">
                  {section.title}
                </h4>
                <CopyButton
                  label="Copy"
                  copied={copiedKey === copyKey}
                  onClick={() =>
                    onCopy(copyKey, sectionText(section.title, section.items))
                  }
                />
              </div>
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
          );
        })}
      </div>
    </section>
  );
}

function ListSection({
  icon: Icon,
  title,
  items,
  copied,
  onCopy,
}: {
  icon: LucideIcon;
  title: string;
  items: string[];
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-blueprint-cyan/15 bg-background/25 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-blueprint-cyan/80">
          <Icon className="h-4 w-4" />
          {title}
        </h3>
        <CopyButton label="Copy" copied={copied} onClick={onCopy} />
      </div>
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

function CopyButton({
  label,
  copied,
  onClick,
}: {
  label: string;
  copied: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0 border-blueprint-cyan/20 bg-background/30 text-foreground hover:bg-blueprint-cyan/10"
      onClick={onClick}
    >
      {copied ? (
        <ClipboardCheck className="h-3.5 w-3.5 text-blueprint-cyan" />
      ) : (
        <Clipboard className="h-3.5 w-3.5" />
      )}
      {copied ? "Copied" : label}
    </Button>
  );
}
