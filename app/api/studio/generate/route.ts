// app/api/studio/generate/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getMemoryForGeneration } from "@/lib/ai/getMemoryForGeneration";
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
    const { workspaceId = null, brand, gen } = body;

    // 3) Founder Style Profile
    const { data: founderProfile } = await supabase
      .from("founder_style_profiles")
      .select("profile_text")
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 4) Memory signals
    const memory = await getMemoryForGeneration({
      userId,
      workspaceId,
      mode: "generate",
      platform: gen?.platform,
      idea: gen?.idea,
    });

    // 5) Prompt
    const systemPrompt = `
You are Architecta — an AI content architect for founders.

PRIORITY ORDER:
1. User request
2. Brand Kit
3. Founder Style Profile
4. Memory signals

FOUNDER STYLE PROFILE:
${founderProfile?.profile_text ?? "Not established yet."}

MEMORY SIGNALS:
${memory.summary}

BRAND KIT:
${JSON.stringify(brand ?? {}, null, 2)}

GENERATION REQUEST:
${JSON.stringify(gen ?? {}, null, 2)}

Rules:
- Do not mention memory or profiles
- Match founder tone
- Be concise and practical
- Output only the requested content
`.trim();

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
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

    return NextResponse.json({ ok: true, output });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Generate failed" },
      { status: 500 }
    );
  }
}
