import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buildSharedSignupHref } from "@/lib/auth/redirects";
import {
  ArrowRight,
  Play,
} from "lucide-react";

const CTASection = () => {
  return (
    <section id="pricing" className="relative overflow-hidden py-32">
      <div className="absolute inset-0 bg-secondary/30" />
      <div className="absolute top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 bg-gradient-glow opacity-30" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="mx-auto mb-20 max-w-4xl text-center">
          <span className="mb-4 inline-block text-sm font-medium tracking-wider uppercase text-primary">
            Pricing
          </span>

          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight mb-6">
            Start free.{" "}
            <span className="text-gradient italic">Upgrade when you grow.</span>
          </h2>

          <Button size="lg" asChild className="group">
            <Link href={buildSharedSignupHref()}>
              Start Creating for Free
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </div>

        <div className="mx-auto max-w-4xl border-t border-border/30 pt-16 text-center">
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight mb-6">
            Stop overthinking your{" "}
            <span className="text-gradient italic">marketing.</span>
          </h2>

          <div className="flex flex-col items-center gap-4 sm:flex-row justify-center">
            <Button size="lg" asChild className="group">
              <Link href={buildSharedSignupHref()}>
                Start Creating for Free
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>

            <Button variant="outline" size="lg" asChild>
              <Link href="#how-it-works">
                <Play className="mr-2 h-5 w-5" />
                See How It Works
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
