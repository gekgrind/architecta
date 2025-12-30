import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Twitter, Linkedin, Youtube, Instagram } from "lucide-react";

const Footer = () => {
  const footerLinks = {
    Product: [
      { name: "Features", href: "#features" },
      { name: "Pricing", href: "#pricing" },
      { name: "How It Works", href: "#how-it-works" },
    ],
    Company: [
      { name: "About", href: "#about" },
      { name: "Blog", href: "#" },
      { name: "Careers", href: "#" },
    ],
    Resources: [
      { name: "Help Center", href: "#" },
      { name: "Templates", href: "#" },
      { name: "Community", href: "#" },
    ],
    Legal: [
      { name: "Privacy", href: "#" },
      { name: "Terms", href: "#" },
    ],
  };

  const socialLinks = [
    { icon: Twitter, href: "#", label: "Twitter" },
    { icon: Linkedin, href: "#", label: "LinkedIn" },
    { icon: Youtube, href: "#", label: "YouTube" },
    { icon: Instagram, href: "#", label: "Instagram" },
  ];

  return (
    <footer
      id="about"
      className="border-t border-border/30 bg-background py-20"
    >
      <div className="container mx-auto px-6">
        <div className="mb-16 grid grid-cols-2 gap-8 md:grid-cols-6">
          {/* Brand Column */}
          <div className="col-span-2">
            <Link href="/" className="mb-6 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary">
                <span className="font-display text-xl font-bold text-primary-foreground">
                  A
                </span>
              </div>
              <span className="font-display text-xl font-semibold text-foreground">
                Architecta<span className="text-gradient">.</span>
              </span>
            </Link>

            <p className="mb-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              The AI content studio that turns strategy into content and content
              into growth.
            </p>

            <p className="mb-6 text-xs text-muted-foreground/60">
              Part of the Entrepreneuria AI Business Suite
            </p>

            <div className="flex items-center gap-3">
              {socialLinks.map((social) => (
                <Link
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-all duration-300 hover:bg-primary/20 hover:text-foreground"
                >
                  <social.icon className="h-5 w-5" />
                </Link>
              ))}
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="mb-4 font-semibold text-foreground">
                {category}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter */}
        <div className="flex flex-col items-center justify-between gap-6 border-t border-border/30 py-8 md:flex-row">
          <div>
            <h4 className="mb-1 font-semibold text-foreground">
              Stay in the loop
            </h4>
            <p className="text-sm text-muted-foreground">
              Get updates on new features and tips.
            </p>
          </div>

          <div className="flex w-full items-center gap-3 md:w-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 rounded-lg border border-border bg-secondary px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 md:w-64"
            />
            <Button variant="default">Subscribe</Button>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-border/30 pt-8 md:flex-row">
          <p className="text-sm text-muted-foreground">
            © 2024 Architecta AI. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            A founder-first content studio—not another AI tool.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
