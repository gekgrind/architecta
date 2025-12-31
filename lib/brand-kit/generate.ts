import { runAI } from "@/lib/ai/router";

export async function generateBrandKit({
  brandProfile,
}: {
  brandProfile: any;
}) {
  const preferClaude = brandProfile.ai_preferences?.preferClaude;

  const overview = await runAI({
    task: "brand_overview",
    preferClaude,
    prompt: `
Create a clear brand overview for:

Brand: ${brandProfile.brand_name}
Offers: ${brandProfile.offers}
Customers: ${brandProfile.typical_customers}
Mission: ${brandProfile.mission}
Vision: ${brandProfile.vision}
`,
  });

  const voice = await runAI({
    task: "brand_voice",
    preferClaude,
    prompt: `
Define brand voice, tone, and messaging guidelines for the brand above.
Include do's and don'ts.
`,
  });

  return {
    overview,
    voice,
  };
}
