import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { LlmPreference } from "./types";

export type UserAiPreference = {
  textProvider: LlmPreference;
  anthropicModel: string;
  openaiTextModel: string;
  openaiImageModel: string;
  openaiVideoModel: string | null;
};

export const DEFAULT_USER_AI_PREFERENCE: UserAiPreference = {
  textProvider: "anthropic",
  anthropicModel: "claude-sonnet-4-6",
  openaiTextModel: "gpt-4o",
  openaiImageModel: "gpt-image-1",
  openaiVideoModel: null,
};

export async function getUserAiPreference(
  userId: string
): Promise<UserAiPreference> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("architecta_user_settings")
    .select(
      "text_provider, anthropic_model, openai_text_model, openai_image_model, openai_video_model"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_USER_AI_PREFERENCE;
  }

  const textProvider =
    data.text_provider === "openai" || data.text_provider === "anthropic"
      ? (data.text_provider as LlmPreference)
      : "auto";

  return {
    textProvider,
    anthropicModel:
      data.anthropic_model ?? DEFAULT_USER_AI_PREFERENCE.anthropicModel,
    openaiTextModel:
      data.openai_text_model ?? DEFAULT_USER_AI_PREFERENCE.openaiTextModel,
    openaiImageModel:
      data.openai_image_model ?? DEFAULT_USER_AI_PREFERENCE.openaiImageModel,
    openaiVideoModel: data.openai_video_model ?? null,
  };
}

export type SetUserAiPreferenceInput = Partial<
  Omit<UserAiPreference, "openaiVideoModel">
> & {
  openaiVideoModel?: string | null;
};

export async function setUserAiPreference(
  userId: string,
  input: SetUserAiPreferenceInput
): Promise<UserAiPreference> {
  const supabase = await createSupabaseServerClient();

  const existing = await getUserAiPreference(userId);
  const merged: UserAiPreference = {
    textProvider: input.textProvider ?? existing.textProvider,
    anthropicModel: input.anthropicModel ?? existing.anthropicModel,
    openaiTextModel: input.openaiTextModel ?? existing.openaiTextModel,
    openaiImageModel: input.openaiImageModel ?? existing.openaiImageModel,
    openaiVideoModel:
      input.openaiVideoModel === undefined
        ? existing.openaiVideoModel
        : input.openaiVideoModel,
  };

  const { error } = await supabase.from("architecta_user_settings").upsert(
    {
      user_id: userId,
      text_provider: merged.textProvider,
      anthropic_model: merged.anthropicModel,
      openai_text_model: merged.openaiTextModel,
      openai_image_model: merged.openaiImageModel,
      openai_video_model: merged.openaiVideoModel,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw new Error(`Failed to save AI preferences: ${error.message}`);
  }

  return merged;
}
