import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEFAULT_TEXT_MODEL,
  isAllowedImageModel,
  isAllowedTextModel,
  isAllowedVideoModel,
} from "./policy";
import type { LlmPreference } from "./types";

export type UserAiPreference = {
  textProvider: LlmPreference;
  anthropicModel: string;
  openaiTextModel: string;
  openaiImageModel: string;
  openaiVideoModel: string | null;
};

// No settings row means "auto": task routing picks the model, not a paid pin.
export const DEFAULT_USER_AI_PREFERENCE: UserAiPreference = {
  textProvider: "auto",
  anthropicModel: DEFAULT_TEXT_MODEL.anthropic,
  openaiTextModel: DEFAULT_TEXT_MODEL.openai,
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

  // Stored model ids are only honoured when they are on the server allowlist.
  return {
    textProvider,
    anthropicModel: isAllowedTextModel("anthropic", data.anthropic_model)
      ? data.anthropic_model
      : DEFAULT_USER_AI_PREFERENCE.anthropicModel,
    openaiTextModel: isAllowedTextModel("openai", data.openai_text_model)
      ? data.openai_text_model
      : DEFAULT_USER_AI_PREFERENCE.openaiTextModel,
    openaiImageModel: isAllowedImageModel(data.openai_image_model)
      ? data.openai_image_model
      : DEFAULT_USER_AI_PREFERENCE.openaiImageModel,
    openaiVideoModel: isAllowedVideoModel(data.openai_video_model)
      ? data.openai_video_model
      : null,
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
