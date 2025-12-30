import { Wand2, Layers, CheckCircle2 } from "lucide-react";

const SolutionSection = () => {
  const solutions = [
    {
      icon: Wand2,
      title: "From strategy to content—automatically",
      description:
        "Architecta turns your goals, offers, and audience into ready-to-use content without you having to think like a marketer.",
    },
    {
      icon: Layers,
      title: "One studio, every platform",
      description:
        "Create content once and instantly adapt it for social posts, emails, blogs, ads, and landing pages—without rewriting.",
    },
    {
      icon: CheckCircle2,
      title: "You stay in control",
      description:
        "Nothing is published without your approval. Edit, tweak, save, and reuse content exactly how and when you want.",
    },
  ];

  return (
    <section id="solution" className="relative overflow-hidden py-32">
      {/* Background */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute left-0 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />

      <div className="container mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="mx-auto mb-20 max-w-3xl text-center">
          <span className="mb-4 inline-block text-sm font-medium tracking-wider uppercase text-primary">
            The Solution
          </span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight mb-6">
            Marketing that finally{" "}
            <span className="text-gradient italic">fits your workflow.</span>
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            Architecta removes the friction between having an idea and putting
            high-quality content into the world.
          </p>
        </div>

        {/* Solution Grid */}
        <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-8">
          {solutions.map((item) => (
            <div
              key={item.title}
              className="h-full rounded-2xl border border-border/50 bg-gradient-card p-8 transition-all duration-500 hover:border-primary/30 hover:shadow-card"
            >
              {/* Icon */}
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                <item.icon className="h-7 w-7 text-primary" />
              </div>

              {/* Title */}
              <h3 className="font-display mb-3 text-xl font-semibold text-foreground">
                {item.title}
              </h3>

              {/* Description */}
              <p className="leading-relaxed text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;
