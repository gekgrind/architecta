import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type Revision = {
  tone?: "clearer" | "bolder" | "same";
  length?: "shorter" | "same" | "longer";
  ctaStrength?: "subtle" | "same" | "stronger";
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const { platform, draft, revision, brand } = body ?? {};

    if (!platform || !draft || !revision) {
      return NextResponse.json(
        { ok: false, error: "Missing refine payload" },
        { status: 400 }
      );
    }

    // ✅ RLS-safe Supabase client
    const supabase = createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    /* ------------------------------------------------------------
     * Build refinement instructions
     * ---------------------------------------------------------- */
    const instructions: string[] = [];

    if (revision.tone === "clearer") instructions.push("Make the tone clearer and more direct.");
    if (revision.tone === "bolder") instructions.push("Make the tone bolder and more confident.");

    if (revision.length === "shorter") instructions.push("Make the content more concise.");
    if (revision.length === "longer") instructions.push("Expand the content slightly.");

    if (revision.ctaStrength === "stronger") instructions.push("Strengthen the call to action.");
    if (revision.ctaStrength === "subtle") instructions.push("Soften the call to action.");

    const systemPrompt = `
You are a professional marketing writer.
Preserve the original intent.
Do not introduce new ideas.
Apply only the requested refinements.
`;

    const userPrompt = `
Platform: ${platform}
Brand: ${brand?.brandName ?? "Unknown"}

Original draft:
"""
${draft}
"""

Refinement instructions:
- ${instructions.join("\n- ")}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
    });

    const refinedText =
      completion.choices[0]?.message?.content?.trim();

    if (!refinedText) {
      throw new Error("No refined output returned");
    }

    /* ------------------------------------------------------------
     * AI MEMORY LEARNING (this is the magic)
     * ---------------------------------------------------------- */
    const memorySignals: {
      signal_type: string;
      signal_value: string;
      confidence: number;
      source: string;
    }[] = [];

    if (revision.length && revision.length !== "same") {
      memorySignals.push({
        signal_type: "length",
        signal_value: revision.length,
        confidence: 0.15,
        source: "architecta",
      });
    }

    if (revision.tone && revision.tone !== "same") {
      memorySignals.push({
        signal_type: "tone",
        signal_value: revision.tone,
        confidence: 0.15,
        source: "architecta",
      });
    }

    if (revision.ctaStrength && revision.ctaStrength !== "same") {
      memorySignals.push({
        signal_type: "cta",
        signal_value: revision.ctaStrength,
        confidence: 0.1,
        source: "architecta",
      });
    }

    if (memorySignals.length > 0) {
      const { error: memError } = await supabase
        .from("ai_edit_memory")
        .insert(
          memorySignals.map((m) => ({
            ...m,
            user_id: user.id,
          }))
        );

      // Memory failure should never block refinement
      if (memError) {
        console.warn("AI memory insert warning:", memError);
      }
    }

    return NextResponse.json({
      ok: true,
      text: refinedText,
    });
  } catch (err) {
    console.error("Studio refine route error:", err);
    return NextResponse.json(
      { ok: false, error: "Server error" },
      { status: 500 }
    );
  }
}
