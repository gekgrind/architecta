import { DEFAULT_TEXT_MODEL, isAllowedTextModel } from "./policy";
import { NVIDIA_GLM, TASK_ROUTES, normalizeTier } from "./tasks";
import type { LlmPreference, LlmProvider, ModelChoice, QualityTier, TaskType } from "./types";

export type RoutePlan = {
  primary: ModelChoice;
  fallbacks: ModelChoice[];
};

/** At most one cross-provider fallback step per request. */
export const MAX_FALLBACK_STEPS = 1;

// One step per provider, using models already confirmed in this config. (The
// previous `claude-3-5-sonnet-latest` fallback pointed at a retired model.)
const FALLBACKS_BY_PROVIDER: Record<LlmProvider, ModelChoice[]> = {
  openai: [{ provider: "anthropic", model: "claude-sonnet-4-6" }],
  anthropic: [{ provider: "openai", model: "gpt-4o" }],
  // No automatic fallback: NVIDIA failures should stay observable.
  nvidia: [],
};

export type UserModelChoices = {
  anthropic?: string;
  openai?: string;
};

function allowedOrDefault(provider: LlmProvider, model: string | undefined): string {
  return isAllowedTextModel(provider, model) ? model : DEFAULT_TEXT_MODEL[provider];
}

export function buildRoutePlan(args: {
  task: TaskType;
  tier?: QualityTier;
  preference?: LlmPreference; // user override
  workspacePreference?: LlmPreference; // stored setting
  userModels?: UserModelChoices; // stored per-provider model choices
  nvidiaOnly?: boolean; // AI_TEST_PROVIDER=nvidia
}): RoutePlan {
  // Test mode: everything goes to NVIDIA, preferences are ignored, no fallback.
  if (args.nvidiaOnly) {
    return { primary: NVIDIA_GLM, fallbacks: [] };
  }

  const tier = normalizeTier(args.tier);
  const taskRoute = TASK_ROUTES[args.task][tier];

  // NVIDIA-routed tasks ignore provider preferences and never fall back.
  if (taskRoute.provider === "nvidia") {
    return { primary: taskRoute, fallbacks: [] };
  }

  const pref = args.preference ?? args.workspacePreference ?? "auto";

  if (pref === "auto") {
    return {
      primary: taskRoute,
      fallbacks: FALLBACKS_BY_PROVIDER[taskRoute.provider].slice(0, MAX_FALLBACK_STEPS),
    };
  }

  // Pinned provider: use the user's (allowlisted) model for that provider.
  // Never forward the task route's model to a different provider.
  const primary: ModelChoice = {
    provider: pref,
    model: allowedOrDefault(pref, args.userModels?.[pref]),
  };
  return {
    primary,
    fallbacks: FALLBACKS_BY_PROVIDER[pref].slice(0, MAX_FALLBACK_STEPS),
  };
}
