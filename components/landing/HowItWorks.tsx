import { Lightbulb, Cpu, Pencil } from "lucide-react";

const HowItWorks = () => {
  const steps = [
    {
      number: "01",
      icon: Lightbulb,
      title: "Start with an idea or goal",
      description:
        '"I need to promote my service" — that’s enough. Just bring the spark.',
      example: '"I want to announce my new coaching program"',
    },
    {
      number: "02",
      icon: Cpu,
      title: "Architecta builds the content",
      description:
        "Strategy → copy → platform-ready versions. All aligned with your brand voice.",
      example: "Social posts, emails, blog intro — done",
    },
    {
      number: "03",
      icon: Pencil,
      title: "Edit, save, and publish",
      description:
        "Clean. Consistent. Professional. Nothing goes out without your approval.",
      example: "Tweak, polish, and you’re live",
    },
  ];

  return (
    <section id="how-it-works" className="relative overflow-hidden py-32">
      {/* Background */}
      <div className="absolute inset-0 bg-secondary/20" />
      <div className="absolute bottom-0 right-0 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />

      <div className="container mx-auto px-6 relative z-10">
        {/* Section Header */}
        <div className="mx-auto mb-20 max-w-3xl text-center">
          <span className="mb-4 inline-block text-sm font-medium tracking-wider uppercase text-primary">
            How It Works
          </span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight mb-6">
            From idea to impact—{" "}
            <span className="text-gradient italic">in minutes.</span>
          </h2>
        </div>

        {/* Steps */}
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.number} className="relative group">
                {/* Connector */}
                {index < steps.length - 1 && (
                  <div className="absolute top-12 left-[calc(100%+1rem)] hidden h-px w-[calc(100%-2rem)] bg-gradient-to-r from-primary/50 to-transparent md:block" />
                )}

                <div className="h-full rounded-2xl border border-border/50 bg-gradient-card p-8 transition-all duration-500 hover:border-primary/30 hover:shadow-card">
                  {/* Number & Icon */}
                  <div className="mb-6 flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 transition-colors duration-300 group-hover:bg-primary/20">
                      <step.icon className="h-8 w-8 text-primary" />
                    </div>
                    <span className="font-display text-4xl font-bold text-muted-foreground/30">
                      {step.number}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-display mb-3 text-xl font-semibold text-foreground">
                    {step.title}
                  </h3>

                  {/* Description */}
                  <p className="mb-4 leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>

                  {/* Example */}
                  <div className="rounded-lg border border-border/30 bg-secondary/50 p-3">
                    <p className="text-sm italic text-muted-foreground">
                      {step.example}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
