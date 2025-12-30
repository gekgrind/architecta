// lib/ai/getMemoryForGeneration.ts
import { createSupabaseServerClient } from "@/lib/supabase/client";

export type GenerationMemory = {
  summary: string;          // short, model-friendly “memory context”
  bullets: string[];        // optional debug/UI use
};

function compactLines(lines: string[], max = 12) {
  return lines
    .filter(Boolean)
    .slice(0, max)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function getMemoryForGeneration(args: {
  userId: string;
  workspaceId?: string | null;
  mode?: string;                 // "tweet" | "linkedin" | etc
  idea?: string;
  platform?: string;
}) : Promise<GenerationMemory> {
  const supabase = createSupabaseServerClient();

  // 1) Grab learned preferences (from your "AI learns from edits" step)
  // Adjust table/column names to match your schema.
  const { data: prefs } = await supabase
    .from("architecta_preferences")
    .select("key, value, weight, updated_at")
    .eq("user_id", args.userId)
    .order("weight", { ascending: false })
    .limit(20);

  // 2) Grab recent refinements (what they changed after generation)
  const { data: refinements } = await supabase
    .from("architecta_refinements")
    .select("before_text, after_text, mode, platform, created_at")
    .eq("user_id", args.userId)
    .order("created_at", { ascending: false })
    .limit(8);

  // 3) Optional: recent saved graphs / drafts (if you want style patterns)
  const { data: saved } = await supabase
    .from("architecta_graphs")
    .select("title, nodes, created_at")
    .eq("user_id", args.userId)
    .order("created_at", { ascending: false })
    .limit(6);

  const bullets: string[] = [];

  if (prefs?.length) {
    bullets.push("User preferences (learned):");
    for (const p of prefs) bullets.push(`- ${p.key}: ${p.value}`);
  }

  if (refinements?.length) {
    bullets.push("Recent refinement patterns:");
    for (const r of refinements) {
      const before = (r.before_text ?? "").slice(0, 140).replace(/\s+/g, " ").trim();
      const after = (r.after_text ?? "").slice(0, 140).replace(/\s+/g, " ").trim();
      if (before && after) bullets.push(`- Changed: "${before}" → "${after}"`);
    }
  }

  if (saved?.length) {
    bullets.push("Recent work context (titles only):");
    for (const s of saved) bullets.push(`- ${s.title ?? "Untitled"} (${new Date(s.created_at).toLocaleDateString()})`);
  }

  const compact = compactLines(bullets, 18);

  const summary =
`MEMORY CONTEXT (use as guidance, not as content to copy):
${compact.map((l) => l.startsWith("-") ? l : l).join("\n")}
Rules:
- Follow these preferences unless the user request conflicts.
- Keep outputs consistent with the user’s recent edits/style.`;

  return { summary, bullets: compact };
}
