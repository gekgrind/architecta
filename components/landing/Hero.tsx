import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Zap, RefreshCw, Share2 } from "lucide-react";

const Hero = () => {
  const stats = [
    { icon: Zap, label: "Create content 5x faster" },
    { icon: RefreshCw, label: "Replace agency workflows" },
    { icon: Share2, label: "Publish everywhere from one studio" },
  ];

  return (
    <section className="relative flex min-h-screen flex-col justify-center overflow-hidden pt-24">
      {/* Background */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 bg-gradient-hero opacity-80" />
      <div className="absolute top-1/2 left-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-glow opacity-40 animate-pulse-glow" />

      {/* Accent glows */}
      <div className="absolute top-1/4 right-[15%] h-64 w-64 rounded-full bg-primary/10 blur-3xl animate-float" />
      <div className="absolute bottom-1/4 left-[10%] h-48 w-48 rounded-full bg-accent/10 blur-3xl animate-float-delayed" />

      <div className="container relative z-10 mx-auto px-6">
        <div className="mx-auto max-w-5xl text-center">
          {/* Headline */}
          <h1 className="font-display text-5xl font-medium tracking-tight md:text-7xl lg:text-8xl">
            Turn ideas
            <span className="mt-2 block text-gradient italic">
              into impact.
            </span>
          </h1>

          {/* Subhead */}
          <p className="mx-auto mt-6 max-w-3xl text-lg text-muted-foreground md:text-xl">
            An AI content studio built for founders and small businesses—turning
            strategy into content and content into growth.
          </p>

          <p className="mt-4 text-sm text-muted-foreground/80">
            Professional marketing—without the agency price tag.
          </p>

          {/* CTAs */}
          <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              className="h-12 px-8 text-base font-medium rounded-xl bg-primary text-primary-foreground shadow-glow transition-all hover:scale-[1.02]"
            >
              Start Creating for Free
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>

            <Button
              variant="outline"
              className="h-12 px-8 text-base rounded-xl backdrop-blur border-border/50"
            >
              <Play className="mr-2 h-5 w-5" />
              See How It Works
            </Button>
          </div>

          {/* Social proof */}
          <div className="mx-auto mt-20 max-w-3xl">
            <p className="mb-8 text-xs uppercase tracking-widest text-muted-foreground">
              Trusted by founders, creators, and small teams building real businesses.
            </p>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center justify-center gap-3 rounded-xl border border-border/40 bg-gradient-card px-4 py-5 shadow-card"
                >
                  <stat.icon className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Suite line */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
        <p className="text-xs tracking-wider text-muted-foreground/60">
          Part of the Entrepreneuria AI Business Suite
        </p>
      </div>
    </section>
  );
};

export default Hero;
