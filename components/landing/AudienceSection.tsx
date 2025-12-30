import { Users, Briefcase, Rocket } from "lucide-react";

const AudienceSection = () => {
  const audiences = [
    {
      icon: Users,
      title: "Solo founders",
      description:
        "You’re doing everything yourself. Architecta helps you create consistent, professional marketing without hiring an agency or learning copywriting.",
      tagline: "Build momentum without burnout",
    },
    {
      icon: Briefcase,
      title: "Small teams",
      description:
        "You have a product or service, but marketing always slips down the priority list. Architecta keeps your content moving while you run the business.",
      tagline: "Stay visible while you stay focused",
    },
    {
      icon: Rocket,
      title: "Growing businesses",
      description:
        "You’re ready to scale content without scaling complexity. Architecta brings structure, speed, and consistency as your brand grows.",
      tagline: "Scale content, not chaos",
    },
  ];

  return (
    <section id="audience" className="relative overflow-hidden py-32">
      {/* Background */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute top-0 right-0 h-[400px] w-[400px] rounded-full bg-primary/5 blur-3xl" />

      <div className="container mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="mx-auto mb-20 max-w-3xl text-center">
          <span className="mb-4 inline-block text-sm font-medium tracking-wider uppercase text-primary">
            Who It’s For
          </span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight mb-6">
            Built for people who want great{" "}
            <span className="text-gradient italic">marketing results</span>{" "}
            without the marketing headache.
          </h2>
        </div>

        {/* Audience Cards */}
        <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-8">
          {audiences.map((audience, index) => (
            <div
              key={audience.title}
              className="group h-full rounded-2xl border border-border/50 bg-gradient-card p-8 transition-all duration-500 hover:border-primary/30 hover:shadow-card"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Icon */}
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 transition-colors duration-300 group-hover:bg-primary/20">
                <audience.icon className="h-7 w-7 text-primary" />
              </div>

              {/* Title */}
              <h3 className="font-display mb-3 text-xl font-semibold text-foreground">
                {audience.title}
              </h3>

              {/* Description */}
              <p className="mb-6 leading-relaxed text-muted-foreground">
                {audience.description}
              </p>

              {/* Tagline */}
              <p className="text-sm font-medium italic text-primary">
                {audience.tagline}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AudienceSection;
