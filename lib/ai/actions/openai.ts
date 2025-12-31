"use server";

import OpenAI from "openai";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Initialize OpenAI client (server-only)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateWithOpenAI(prompt: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // fast + cheap default (upgrade later if needed)
      messages: [
        {
          role: "system",
          content:
            "You are a professional brand strategist and copywriter. Be clear, structured, and practical.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    const text = response.choices[0]?.message?.content ?? "";

    return { ok: true, text };
  } catch (error: any) {
    console.error("OpenAI error:", error);

    return {
      ok: false,
      error: "Failed to generate response with OpenAI",
    };
  }
}
