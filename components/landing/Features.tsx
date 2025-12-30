import {
  Lightbulb,
  Target,
  Mic2,
  Layers,
  Wand2,
  FolderOpen,
} from "lucide-react";

const Features = () => {
  const features = [
    {
      icon: Lightbulb,
      title: "Idea Builder",
      description:
        "Turn rough thoughts into clear content ideas. Start with a sentence, a goal, or a messy brain dump. Architecta helps you shape it into something worth publishing.",
      highlight:
        'Perfect for "I know what I want to say, I just don’t know how to say it."',
    },
    {
      icon: Target,
      title: "Strategy-to-Content Engine",
      description:
        "Your strategy—translated into content automatically. Tell Architecta who you help, what you offer, and how you want to sound. It applies that strategy to every piece of content you create.",
      highlight: 'No "rewrite this again" nonsense',
    },
    {
      icon: Mic2,
      title: "Brand Voice Studio",
      description:
        "Sound like you. Everywhere. Train Architecta on your tone, style, and preferences so your content stays consistent, professional, and unmistakably yours.",
      highlight: 'No more "this doesn’t sound like me"',
    },
    {
      icon: Layers,
      title: "Multi-Platform Generator",
      description:
        "Create once. Publish everywhere. Architecta automatically adapts your content for social posts, emails, blogs, ads, and landing pages.",
      highlight: "No copy-paste chaos. No rewriting from scratch.",
    },
    {
      icon: Wand2,
      title: "Smart Editing Tools",
      description:
        "Polish without rewriting. Instantly adjust tone, length, and clarity—make it shorter, bolder, friendlier, or more confident. You stay in control. Architecta does the heavy lifting.",
      highlight: "Perfect for non-writers",
    },
    {
      icon: FolderOpen,
      title: "Content Library",
      description:
        "Everything you’ve created—organized and reusable. Save, edit, remix, and reuse content anytime. Your ideas don’t disappear—they compound.",
      highlight: 'Think "content brain", not "content mess"',
    },
  ];

  return (
    <section id="features" className="relative overflow-hidden py-32">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-6 relative z-10">
        {/* Section Header */}
        <div className="mx-auto mb-20 max-w-3xl text-center">
          <span className="mb-4 inline-block text-sm font-medium tracking-wider uppercase text-primary">
            Features
          </span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-medium tracking-tight mb-6">
            Everything you need to create great marketing{" "}
            <span className="text-gradient italic">
              without becoming a marketer.
            </span>
          </h2>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-border/50 bg-gradient-card p-8 transition-all duration-500 hover:border-primary/30 hover:shadow-card"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Icon */}
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 transition-colors duration-300 group-hover:bg-primary/20">
                <feature.icon className="h-7 w-7 text-primary" />
              </div>

              {/* Title */}
              <h3 className="font-display mb-3 text-xl font-semibold text-foreground">
                {feature.title}
              </h3>

              {/* Description */}
              <p className="mb-4 leading-relaxed text-muted-foreground">
                {feature.description}
              </p>

              {/* Highlight */}
              <p className="text-sm font-medium italic text-primary">
                {feature.highlight}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
