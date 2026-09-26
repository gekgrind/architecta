import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join, relative, resolve } from "path";
import { describe, expect, it } from "vitest";

/**
 * Static guard: every user-reachable code path that can spend AI money must
 * pass the server-side AI usage guard, and no route may talk to a paid
 * provider SDK directly (which would bypass NVIDIA-only mode, allowlists,
 * token caps, timeouts and usage logging).
 */

const ROOT = resolve(__dirname, "../..");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const AI_CALL = /\b(runGateway|generateImage|generateVideo)\s*\(/;
const GUARD = /\b(enforceAiUsage|checkAiUsage)\s*\(/;

function userReachableFiles(): string[] {
  const appFiles = walk(join(ROOT, "app"));
  // Server actions are user-reachable too.
  const serverActions = walk(join(ROOT, "lib")).filter((f) =>
    /^\s*["']use server["']/m.test(readFileSync(f, "utf-8"))
  );
  return [...appFiles, ...serverActions];
}

describe("AI entry points", () => {
  it("every route/server action that calls an AI provider is rate-limited and budgeted", () => {
    const unguarded: string[] = [];
    for (const file of userReachableFiles()) {
      const src = readFileSync(file, "utf-8");
      if (AI_CALL.test(src) && !GUARD.test(src)) unguarded.push(relative(ROOT, file));
    }
    // Website analysis is reached via a server action in lib/onboarding/actions.ts
    // and guards inside analyzeWebsite(), right before the model call.
    const websiteAnalysis = readFileSync(join(ROOT, "lib/onboarding/website-analysis.ts"), "utf-8");
    expect(GUARD.test(websiteAnalysis)).toBe(true);

    expect(unguarded).toEqual([]);
  });

  it("no route imports a paid provider SDK directly", () => {
    const offenders = walk(join(ROOT, "app")).filter((file) => {
      const src = readFileSync(file, "utf-8");
      return (
        /from ["']openai["']/.test(src) ||
        /from ["']@anthropic-ai\/sdk["']/.test(src) ||
        /new OpenAI\s*\(/.test(src) ||
        src.includes("api.openai.com") ||
        src.includes("api.anthropic.com")
      );
    });
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });

  it("the generic client-controlled /api/llm/generate endpoint is gone", () => {
    expect(existsSync(join(ROOT, "app/api/llm/generate/route.ts"))).toBe(false);
  });
});
