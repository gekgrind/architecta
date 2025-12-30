// app/api/studio/generate/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createSupabaseServerClient } from "@/lib/supabase/client";
import { getMemoryForGeneration } from "@/lib/ai/getMemoryForGeneration";

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
    const {
      workspaceId = null,
      brand,
      gen,
    } = body;

    // 3) Founder Style Profile (human-readable)
    const { data: founderProfile } = await supabase
      .from("founder_style_profiles")
      .select("profile_text")
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 4) Raw memory (preferences, refinements, etc.)
    const memory = await getMemoryForGeneration({
      userId,
      workspaceId,
      mode: "generate",
      platform: gen?.platform,
      idea: gen?.idea,
    });

    // 5) Build prompt
    const systemPrompt = `
You are Architecta — an AI content architect for founders.

PRIORITY ORDER:
1. User request
2. Brand Kit
3. Founder Style Profile
4. Memory signals

FOUNDER STYLE PROFILE (authoritative):
${founderProfile?.profile_text ?? "Not established yet."}

MEMORY SIGNALS (guidance only):
${memory.summary}

BRAND KIT:
${JSON.stringify(brand ?? {}, null, 2)}

GENERATION REQUEST:
${JSON.stringify(gen ?? {}, null, 2)}

Rules:
- Do not mention memory or profiles explicitly
- Match founder tone and structure
- Be concise, confident, and practical
- Output only the requested content
`.trim();

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Generate the content now." },
      ],
    });

    const output = completion.choices[0]?.message?.content ?? "";

    return NextResponse.json({
      ok: true,
      output,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Generate failed" },
      { status: 500 }
    );
  }
}
