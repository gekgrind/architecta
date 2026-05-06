"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  Calendar,
  CheckCircle2,
  Compass,
  FileText,
  Flame,
  FolderKanban,
  Globe2,
  Megaphone,
  Palette,
  PenLine,
  Search,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ContentTypeIcon } from "@/components/ui/content-type-icon";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuthIdentity } from "@/hooks/use-auth-identity";
import { mockContentItems } from "@/lib/mock-data";

const metrics = [
  {
    label: "Strategic assets",
    value: "47",
    detail: "Brand, campaign, and content pieces",
    icon: FolderKanban,
  },
  {
    label: "Campaigns mapped",
    value: "6",
    detail: "Launch paths ready to execute",
    icon: Target,
  },
  {
    label: "Content score",
    value: "86",
    detail: "Average fit against brand system",
    icon: TrendingUp,
  },
  {
    label: "Signals tracked",
    value: "18",
    detail: "Market, site, and channel inputs",
    icon: BarChart3,
  },
];

const quickActions = [
  {
    title: "Build brand strategy",
    description: "Tighten voice, positioning, offers, and reusable messaging.",
    href: "/brand-kit",
    icon: Palette,
    eyebrow: "Brand system",
  },
  {
    title: "Plan a campaign",
    description: "Shape the next launch arc from idea to execution sequence.",
    href: "/campaigns",
    icon: Megaphone,
    eyebrow: "Campaign engine",
  },
  {
    title: "Create content",
    description: "Generate founder-led posts, emails, ads, and long-form drafts.",
    href: "/generate",
    icon: PenLine,
    eyebrow: "Content studio",
  },
  {
    title: "Open AI studio",
    description: "Move into the structured canvas for deeper content workflows.",
    href: "/studio",
    icon: Sparkles,
    eyebrow: "Studio canvas",
  },
];

const intelligenceCards = [
  {
    title: "Brand intelligence",
    description: "Voice, audience, and messaging inputs are ready for generation.",
    value: "Ready",
    icon: Brain,
  },
  {
    title: "Site strategist",
    description: "Use web intelligence to turn site signals into campaign angles.",
    value: "Next",
    icon: Globe2,
  },
  {
    title: "FounderFuel",
    description: "Prompt bank for sharper founder POV and execution momentum.",
    value: "Queued",
    icon: Flame,
  },
];

const pipelineStages = [
  {
    title: "Positioning",
    description: "Audience, offer, category, and proof points",
    status: "Active",
  },
  {
    title: "Campaign plan",
    description: "Launch narrative, channels, and weekly sequence",
    status: "Draft",
  },
  {
    title: "Content build",
    description: "Posts, emails, ad copy, and long-form assets",
    status: "Ready",
  },
];

export default function DashboardPage() {
  const { loading, displayName } = useAuthIdentity();
  const recentContent = mockContentItems.slice(0, 4);

  if (loading) {
    return (
      <DashboardLayout breadcrumbs={[{ label: "Dashboard" }]}>
        <div className="space-y-6">
          <div className="h-48 animate-pulse rounded-xl border border-blueprint-cyan/10 bg-blueprint-panel/50" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="h-32 animate-pulse rounded-xl border border-blueprint-cyan/10 bg-blueprint-panel/40"
              />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout breadcrumbs={[{ label: "Dashboard" }]}>
      <div className="space-y-6 lg:space-y-8">
        <section className="relative overflow-hidden rounded-xl border border-blueprint-cyan/20 bg-blueprint-panel/75 p-5 shadow-card backdrop-blur-md sm:p-6 lg:p-8">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blueprint-cyan/70 to-transparent" />
          <div className="absolute right-4 top-4 hidden h-20 w-20 border-r border-t border-blueprint-cyan/25 lg:block" />

          <div className="relative grid gap-6 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-blueprint-cyan/25 bg-blueprint-cyan/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-blueprint-cyan">
                <Compass className="h-3.5 w-3.5" />
                Founder growth engine
              </div>

              <div className="max-w-3xl space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                  Welcome back, {displayName}. Build the strategy, campaign, and
                  content system behind your next move.
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Architecta turns brand intelligence, market signals, and
                  founder POV into execution-ready campaigns and content assets.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <Link href="/studio">
                <Button className="h-11 w-full justify-between bg-primary text-primary-foreground hover:bg-primary/90">
                  Open AI Studio
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/generate">
                <Button
                  variant="outline"
                  className="h-11 w-full justify-between border-blueprint-cyan/25 bg-blueprint-panel/60 text-foreground hover:bg-blueprint-cyan/10"
                >
                  Generate content
                  <Sparkles className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <Card
              key={metric.label}
              className="group overflow-hidden border-blueprint-cyan/20 bg-blueprint-panel/70 shadow-card backdrop-blur-md transition-colors hover:border-blueprint-cyan/45"
            >
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blueprint-cyan/10 text-blueprint-cyan">
                    <metric.icon className="h-5 w-5" />
                  </div>
                  <div className="h-4 w-4 border-r border-t border-blueprint-cyan/35" />
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-semibold text-foreground">
                    {metric.value}
                  </p>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-blueprint-cyan/80">
                    {metric.label}
                  </p>
                  <p className="text-sm leading-5 text-muted-foreground">
                    {metric.detail}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.24em] text-blueprint-cyan/80">
                  Continue work
                </p>
                <h2 className="text-xl font-semibold text-foreground">
                  Pick up the founder workflow
                </h2>
              </div>
              <Link href="/library">
                <Button variant="ghost" size="sm" className="w-fit text-primary">
                  View library
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            <Card className="overflow-hidden border-blueprint-cyan/20 bg-blueprint-panel/70 shadow-card backdrop-blur-md">
              <CardContent className="p-0">
                {recentContent.length > 0 ? (
                  <div className="divide-y divide-blueprint-cyan/10">
                    {recentContent.map((item) => (
                      <div
                        key={item.id}
                        className="grid gap-3 p-4 transition-colors hover:bg-blueprint-cyan/5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-5"
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-blueprint-cyan/20 bg-blueprint-cyan/10">
                          <ContentTypeIcon
                            type={item.contentType}
                            size={20}
                            className="text-blueprint-cyan"
                          />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium text-foreground">
                              {item.title}
                            </p>
                            <StatusBadge status={item.status} />
                          </div>
                          <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
                            {item.content}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground sm:justify-end">
                          <Calendar className="h-4 w-4" />
                          {new Date(item.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-56 flex-col items-center justify-center gap-3 p-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blueprint-cyan/10 text-blueprint-cyan">
                      <BookOpen className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-semibold text-foreground">
                        No projects yet
                      </h3>
                      <p className="max-w-md text-sm text-muted-foreground">
                        Start with a brand strategy or generate your first
                        campaign asset.
                      </p>
                    </div>
                    <Link href="/generate">
                      <Button size="sm">Create first asset</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-blueprint-cyan/80">
                Quick actions
              </p>
              <h2 className="text-xl font-semibold text-foreground">
                Move from idea to execution
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {quickActions.map((action) => (
                <Link key={action.title} href={action.href}>
                  <Card className="group h-full border-blueprint-cyan/20 bg-blueprint-panel/70 backdrop-blur-md transition-colors hover:border-blueprint-cyan/45 hover:bg-blueprint-cyan/5">
                    <CardContent className="flex h-full items-start gap-4 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blueprint-cyan/10 text-blueprint-cyan">
                        <action.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-blueprint-cyan/75">
                          {action.eyebrow}
                        </p>
                        <h3 className="font-semibold text-foreground">
                          {action.title}
                        </h3>
                        <p className="text-sm leading-5 text-muted-foreground">
                          {action.description}
                        </p>
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-blueprint-cyan" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <Card className="border-blueprint-cyan/20 bg-blueprint-panel/70 shadow-card backdrop-blur-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Search className="h-5 w-5 text-blueprint-cyan" />
                Intelligence snapshot
              </CardTitle>
              <CardDescription>
                The operating context behind stronger strategy and content.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {intelligenceCards.map((item) => (
                <div
                  key={item.title}
                  className="flex gap-3 rounded-lg border border-blueprint-cyan/15 bg-background/35 p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blueprint-cyan/10 text-blueprint-cyan">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-medium text-foreground">
                        {item.title}
                      </h3>
                      <span className="rounded-full border border-blueprint-cyan/20 px-2 py-0.5 text-xs text-blueprint-cyan">
                        {item.value}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-blueprint-cyan/20 bg-blueprint-panel/70 shadow-card backdrop-blur-md">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Target className="h-5 w-5 text-blueprint-cyan" />
                  Campaign pipeline
                </CardTitle>
                <CardDescription>
                  A clear path from positioning to launch-ready assets.
                </CardDescription>
              </div>
              <Link href="/campaigns">
                <Button variant="ghost" size="sm" className="w-fit text-primary">
                  Open campaigns
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                {pipelineStages.map((stage, index) => (
                  <div
                    key={stage.title}
                    className="relative rounded-lg border border-blueprint-cyan/15 bg-background/35 p-4"
                  >
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blueprint-cyan/10 text-sm font-semibold text-blueprint-cyan">
                        {index + 1}
                      </span>
                      <span className="rounded-full bg-blueprint-cyan/10 px-2 py-0.5 text-xs text-blueprint-cyan">
                        {stage.status}
                      </span>
                    </div>
                    <h3 className="font-semibold text-foreground">
                      {stage.title}
                    </h3>
                    <p className="mt-2 text-sm leading-5 text-muted-foreground">
                      {stage.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-blueprint-cyan/20 bg-blueprint-panel/70 backdrop-blur-md">
            <CardContent className="flex items-start gap-4 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blueprint-cyan/10 text-blueprint-cyan">
                <FileText className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground">
                  Content studio shortcuts
                </h3>
                <p className="text-sm leading-5 text-muted-foreground">
                  Draft posts, emails, ad copy, and long-form assets from one
                  structured flow.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blueprint-cyan/20 bg-blueprint-panel/70 backdrop-blur-md">
            <CardContent className="flex items-start gap-4 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blueprint-cyan/10 text-blueprint-cyan">
                <Globe2 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground">
                  Web Intelligence / Site Strategist
                </h3>
                <p className="text-sm leading-5 text-muted-foreground">
                  Turn web and market signals into sharper positioning and
                  campaign angles.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blueprint-cyan/20 bg-blueprint-panel/70 backdrop-blur-md">
            <CardContent className="flex items-start gap-4 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blueprint-cyan/10 text-blueprint-cyan">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground">
                  Execution-ready outputs
                </h3>
                <p className="text-sm leading-5 text-muted-foreground">
                  Keep the dashboard focused on what to build, publish, and
                  improve next.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}
