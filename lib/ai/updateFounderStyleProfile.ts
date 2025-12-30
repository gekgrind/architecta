import OpenAI from "openai";

export async function updateFounderStyleProfile({
  existingProfile,
  memorySummary,
}: {
  existingProfile?: string;
  memorySummary: string;
}) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `
You are maintaining a Founder Style Profile.
This profile should be human-readable and concise.

EXISTING PROFILE:
${existingProfile ?? "None yet."}

NEW MEMORY SIGNALS:
${memorySummary}

Rules:
- Update only if there is strong evidence.
- Avoid repeating the same phrasing.
- Keep it short, clear, and practical.
- Write in plain English, not marketing language.

Return ONLY the updated Founder Style Profile text.
`;

  const res = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [{ role: "system", content: prompt }],
    temperature: 0.3,
  });

  return res.choices[0]?.message?.content ?? existingProfile;
}
