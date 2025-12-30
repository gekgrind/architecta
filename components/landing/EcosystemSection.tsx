import { Compass, PenTool, Calendar } from "lucide-react";

const EcosystemSection = () => {
  const tools = [
    {
      icon: Compass,
      name: "Prospra",
      role: "Strategy, clarity, founder guidance",
      status: "Live",
    },
    {
      icon: PenTool,
      name: "Architecta",
      role: "Content creation & execution",
      status: "Live",
      highlight: true,
    },
    {
      icon: Calendar,
      name: "Synceri",
      role: "Life + business admin",
      status: "Coming Soon",
    },
  ];

  return (
    <section className="relative overflow-hidden py-32">
      {/* Background */}
      <div className="absolute inset-0 bg-secondary/20" />
      <div className="absolute top-0 left-1/4 h-[400px] w-[400px] rounded-full bg-accent/5 blur-3xl" />

      <div className="container mx-auto px-6 relative z-10">
        {/* Section Header */}
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <span className="mb-4 inline-block text-sm font-medium tracking-wider uppercase text-primary">
            Ecosystem
          </span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight mb-6">
            Part of the{" "}
            <span className="text-gradient italic">Entrepreneuria</span> AI
            Business Suite
          </h2>
          <p className="text-lg leading-relaxed text-muted-foreground">
            Architecta works seamlessly with other Entrepreneuria tools—so your
            business runs smarter, not harder.
          </p>
        </div>

        {/* Tools Grid */}
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
          {tools.map((tool) => (
            <div
              key={tool.name}
              className={`rounded-2xl border p-8 transition-all duration-300 ${
                tool.highlight
                  ? "border-primary/30 bg-primary/10 shadow-glow"
                  : "border-border/50 bg-gradient-card hover:border-primary/20"
              }`}
            >
              {/* Icon */}
              <div
                className={`mb-6 flex h-14 w-14 items-center justify-center rounded-xl ${
                  tool.highlight ? "bg-primary/20" : "bg-secondary/50"
                }`}
              >
                <tool.icon
                  className={`h-7 w-7 ${
                    tool.highlight
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                />
              </div>

              {/* Name */}
              <h3
                className={`mb-2 font-display text-xl font-semibold ${
                  tool.highlight ? "text-primary" : "text-foreground"
                }`}
              >
                {tool.name}
              </h3>

              {/* Role */}
              <p className="mb-4 text-muted-foreground">{tool.role}</p>

              {/* Status */}
              <span
                className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                  tool.status === "Live"
                    ? "bg-primary/20 text-primary"
                    : "bg-muted/30 text-muted-foreground"
                }`}
              >
                {tool.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default EcosystemSection;
