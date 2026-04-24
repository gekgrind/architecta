import { AlertTriangle } from "lucide-react";

const ProblemSection = () => {
  const painPoints = [
    "Come up with ideas",
    "Write posts, emails, ads, blogs",
    "Stay consistent across platforms",
    "And somehow still run the business",
  ];

  return (
    <section className="py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-secondary/20" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-destructive/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 border border-destructive/20 mb-8">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">The Reality</span>
            </div>
            <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight mb-6">
              Marketing shouldn&apos;t feel{" "}
              <span className="text-gradient italic">this hard.</span>
            </h2>
          </div>

          {/* Content */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xl text-foreground font-medium mb-6">
                You&apos;re running a business - not a marketing department.
              </p>
              <p className="text-muted-foreground mb-6">You&apos;re expected to:</p>
              <ul className="space-y-3 mb-8">
                {painPoints.map((point, index) => (
                  <li
                    key={point}
                    className="flex items-center gap-3 text-muted-foreground"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <span className="w-2 h-2 rounded-full bg-destructive/50" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-8 rounded-2xl bg-gradient-card border border-border/50">
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Most tools are built for marketers.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                Agencies are expensive.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                DIY feels overwhelming.
              </p>
              <p className="text-xl font-display font-semibold text-gradient">
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
