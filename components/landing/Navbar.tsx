"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X, ArrowRight } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const Navbar = () => {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(!!data.session);
    });
  }, [supabase]);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-all ${
        isScrolled
          ? "bg-background/80 backdrop-blur-xl border-b"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-6">
        <div className="flex h-20 items-center justify-between">
          <Link href="/" className="font-display text-xl font-semibold">
            Architecta<span className="text-gradient">.</span>
          </Link>

          {!isAuthenticated ? (
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="sm">
                <Link href="/auth/login">Sign In</Link>
              </Button>

              <Button asChild>
                <Link href="/auth/signup">Start Free</Link>
              </Button>
            </div>
          ) : (
            <Button asChild className="group">
              <Link href="/studio">
                Open Studio
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
