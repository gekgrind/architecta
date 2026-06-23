import { apiError, apiOk, parseJsonBody } from "@/lib/api/response";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { brandProfilePatchSchema } from "@/lib/validation/brand";

export const runtime = "nodejs";

type BrandProfileRow = {
  id: string;
  user_id: string;
  brand_name: string | null;
  industry: string | null;
  website: string | null;
  description: string | null;
  audience: string | null;
  tone: string | null;
  tone_voice: string | null;
  voice_description: string | null;
  topics: Record<string, unknown> | null;
  offers: string | null;
  mission: string | null;
  vision: string | null;
  values: string | null;
  typical_customers: string | null;
  banned_phrases: string[] | null;
  required_elements: string[] | null;
  example_posts: unknown;
  ai_preferences: Record<string, unknown> | null;
  source: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function toCamel(row: BrandProfileRow) {
  return {
    id: row.id,
    userId: row.user_id,
    brandName: row.brand_name,
    industry: row.industry,
    website: row.website,
    description: row.description,
    audience: row.audience,
    tone: row.tone,
    toneVoice: row.tone_voice,
    voiceDescription: row.voice_description,
    topics: row.topics,
    offers: row.offers,
    mission: row.mission,
    vision: row.vision,
    values: row.values,
    typicalCustomers: row.typical_customers,
    bannedPhrases: row.banned_phrases ?? [],
    requiredElements: row.required_elements ?? [],
    examplePosts: row.example_posts,
    aiPreferences: row.ai_preferences ?? {},
    source: row.source ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const { data, error } = await supabase
    .from("brand_profiles")
    .select("*")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) return apiError("server_error", error.message);

  return apiOk({ brandProfile: data ? toCamel(data as BrandProfileRow) : null });
}

export async function PUT(req: Request) {
  const supabase = await createSupabaseServerClient();
  const session = await getAuthenticatedUser(supabase);
  if (!session) return apiError("unauthorized", "Unauthorized");

  const body = await parseJsonBody<unknown>(req);
  const parsed = brandProfilePatchSchema.safeParse(body);

  if (!parsed.success) {
    return apiError("validation_error", "Invalid brand profile payload", {
      details: { issues: parsed.error.flatten() },
    });
  }

  const patch = parsed.data;

  const update: Record<string, unknown> = {
    user_id: session.user.id,
  };
  if (patch.brandName !== undefined) update.brand_name = patch.brandName;
  if (patch.industry !== undefined) update.industry = patch.industry;
  if (patch.website !== undefined) update.website = patch.website;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.audience !== undefined) update.audience = patch.audience;
  if (patch.tone !== undefined) update.tone = patch.tone;
  if (patch.toneVoice !== undefined) update.tone_voice = patch.toneVoice;
  if (patch.voiceDescription !== undefined)
    update.voice_description = patch.voiceDescription;
  if (patch.topics !== undefined) update.topics = patch.topics;
  if (patch.offers !== undefined) update.offers = patch.offers;
  if (patch.mission !== undefined) update.mission = patch.mission;
  if (patch.vision !== undefined) update.vision = patch.vision;
  if (patch.values !== undefined) update.values = patch.values;
  if (patch.bannedPhrases !== undefined)
    update.banned_phrases = patch.bannedPhrases;
  if (patch.requiredElements !== undefined)
    update.required_elements = patch.requiredElements;
  if (patch.examplePosts !== undefined)
    update.example_posts = patch.examplePosts;
  if (patch.aiPreferences !== undefined)
    update.ai_preferences = patch.aiPreferences;

  const { data, error } = await supabase
    .from("brand_profiles")
    .upsert(update, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) return apiError("server_error", error.message);

  return apiOk({ brandProfile: toCamel(data as BrandProfileRow) });
}
