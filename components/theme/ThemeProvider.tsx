"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import BlueprintBackground from "@/components/blueprint/BlueprintBackground";

type ThemeMode = "dark" | "light";

type ThemeContextType = {
  theme: ThemeMode;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const pathname = usePathname();
  const usesAuthenticatedAppBackground =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/analytics" ||
    pathname.startsWith("/analytics/") ||
    pathname === "/brand-kit" ||
    pathname.startsWith("/brand-kit/") ||
    pathname === "/calendar" ||
    pathname.startsWith("/calendar/") ||
    pathname === "/campaigns" ||
    pathname.startsWith("/campaigns/") ||
    pathname === "/content-strategy" ||
    pathname.startsWith("/content-strategy/") ||
    pathname === "/generate" ||
    pathname.startsWith("/generate/") ||
    pathname === "/library" ||
    pathname.startsWith("/library/") ||
    pathname === "/seo" ||
    pathname.startsWith("/seo/") ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname === "/studio" ||
    pathname.startsWith("/studio/");

  // Apply class to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
  }, [theme]);

  function toggleTheme() {
    setTheme(prev => (prev === "dark" ? "light" : "dark"));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {!usesAuthenticatedAppBackground && <BlueprintBackground theme={theme} />}
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
