// app/api/studio/learn/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import { aggregateMemory } from "@/lib/ai/memoryAggregator";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServerClient();

    // 1) Auth
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = auth.user.id;

    // 2) Payload
    const body = await req.json();
    const { workspaceId = null } = body;

    // 3) Fetch memory events and aggregate
    const { data: memoryEvents } = await supabase
      .from("memory_events")
      .select("*")
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId);

    const aggregated = aggregateMemory(memoryEvents ?? []);

    if (!aggregated || aggregated.length === 0) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // 4) Fetch existing Founder Style Profile
    const { data: existing } = await supabase
      .from("founder_style_profiles")
      .select("*")
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 5) Ask AI to evolve the profile (human-readable)
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
You maintain a Founder Style Profile.
It must be human-readable, concise, and practical.

EXISTING PROFILE:
${existing?.profile_text ?? "None yet."}

NEW MEMORY SIGNALS:
${aggregated.map((pref: any) => pref.summary ?? pref.text).join("\n")}

Rules:
- Update only if strong evidence exists
- Avoid repetition
- Write in plain English
- No marketing fluff
- Keep it short and clear

Return ONLY the updated Founder Style Profile text.
`.trim();

    const res = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      messages: [{ role: "system", content: prompt }],
    });

    const updatedProfile =
      res.choices[0]?.message?.content?.trim() ??
      existing?.profile_text;

    // 6) Persist only if changed
    if (
      updatedProfile &&
      updatedProfile !== existing?.profile_text
    ) {
      await supabase.from("founder_style_profiles").insert({
        user_id: userId,
        workspace_id: workspaceId,
        profile_text: updatedProfile,
        version: (existing?.version ?? 0) + 1,
        confidence_score: Math.min(
          1,
          (existing?.confidence_score ?? 0.5) + 0.05
        ),
      });
    }

    return NextResponse.json({
      ok: true,
      updated: updatedProfile !== existing?.profile_text,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Learn failed" },
      { status: 500 }
    );
  }
}
