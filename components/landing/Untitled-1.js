import { AlertTriangle } from "lucide-react";

const ProblemSection = () => {
  const painPoints = [
    "Come up with ideas",
    "Write posts, emails, ads, blogs",
    "Stay consistent across platforms",
    "And somehow still run the business",
  ];

  return (
    <section className="relative overflow-hidden py-32">
      {/* Background */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute top-0 right-0 h-[500px] w-[500px] rounded-full bg-destructive/10 blur-3xl" />
      <div className="absolute inset-0 bg-gradient-hero opacity-60" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="mx-auto max-w-4xl">
          {/* Section Header */}
          <div className="mb-16 text-center">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/15 px-4 py-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">
                The Reality
              </span>
            </div>

            <h2 className="font-display text-4xl font-medium tracking-tight md:text-5xl lg:text-6xl">
              Marketing shouldn&apos;t feel{" "}
              <span className="text-gradient italic">this hard.</span>
            </h2>
          </div>

          {/* Content */}
          <div className="grid items-center gap-12 md:grid-cols-2">
            {/* Left */}
            <div>
              <p className="mb-6 text-xl font-medium text-foreground">
                You&apos;re running a business—not a marketing department.
              </p>

              <p className="mb-6 text-muted-foreground">
                You&apos;re expected to:
              </p>

              <ul className="mb-8 space-y-4">
                {painPoints.map((point) => (
                  <li
                    key={point}
                    className="flex items-center gap-3 text-muted-foreground"
                  >
                    <span className="h-2 w-2 rounded-full bg-destructive/70" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right Card */}
            <div className="rounded-2xl border border-border/50 bg-gradient-card p-8 shadow-card">
              <p className="mb-6 text-lg leading-relaxed text-muted-foreground">
                Most tools are built for marketers.
              </p>
              <p className="mb-6 text-lg leading-relaxed text-muted-foreground">
                Agencies are expensive.
              </p>
              <p className="mb-8 text-lg leading-relaxed text-muted-foreground">
                DIY feels overwhelming.
              </p>

              <p className="font-display text-xl font-semibold text-gradient">
                Architecta fixes that.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
