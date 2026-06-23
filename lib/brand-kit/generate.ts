import "server-only";

import { runGateway } from "@/lib/ai/llm/run";

type BrandProfileForGeneration = {
  brand_name?: string | null;
  offers?: string | null;
  typical_customers?: string | null;
  mission?: string | null;
  vision?: string | null;
};

export async function generateBrandKit({
  userId,
  brandProfile,
}: {
  userId: string;
  brandProfile: BrandProfileForGeneration;
}) {
  const contextBlock = `
Brand: ${brandProfile.brand_name ?? "Unknown"}
Offers: ${brandProfile.offers ?? "Unknown"}
Customers: ${brandProfile.typical_customers ?? "Unknown"}
Mission: ${brandProfile.mission ?? "Unknown"}
Vision: ${brandProfile.vision ?? "Unknown"}
`.trim();

  const [overview, voice] = await Promise.all([
    runGateway({
      userId,
      task: "BRAND_OVERVIEW",
      prompt: `Create a clear brand overview for:\n\n${contextBlock}`,
    }),
    runGateway({
      userId,
      task: "BRAND_VOICE",
      prompt: `Define brand voice, tone, and messaging guidelines for the brand above. Include do's and don'ts.\n\n${contextBlock}`,
    }),
  ]);

  return {
    overview: overview.text,
    voice: voice.text,
  };
}
