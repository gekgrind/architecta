// app/api/studio/learn/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { aggregateMemory } from "@/lib/ai/memoryAggregator";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const runtime = "nodejs";

async function getSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
}

export async function POST(req: Request) {
  try {
    const supabase = await getSupabaseServer();

    // 1) Auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // 2) Payload
    const body = await req.json();
    const { workspaceId = null } = body;

    // 3) Memory events
    const { data: memoryEvents } = await supabase
      .from("memory_events")
      .select("*")
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId);

    const aggregated = aggregateMemory(memoryEvents ?? []);

    if (!aggregated || aggregated.length === 0) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // 4) Existing profile
    const { data: existing } = await supabase
      .from("founder_style_profiles")
      .select("*")
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 5) AI refinement
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const prompt = `
You maintain a Founder Style Profile.
It must be human-readable and practical.

EXISTING PROFILE:
${existing?.profile_text ?? "None yet."}

NEW MEMORY SIGNALS:
${aggregated.map((p: any) => p.summary ?? p.text).join("\n")}

Rules:
- Update only with strong evidence
- Avoid repetition
- Plain English
- Short and clear

Return ONLY the updated profile text.
`.trim();

    const res = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      messages: [{ role: "system", content: prompt }],
    });

    const updatedProfile =
      res.choices[0]?.message?.content?.trim() ??
      existing?.profile_text;

    // 6) Persist if changed
    if (updatedProfile && updatedProfile !== existing?.profile_text) {
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
