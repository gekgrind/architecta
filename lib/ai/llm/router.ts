import { TASK_ROUTES, normalizeTier } from "./tasks";
import type { LlmPreference, LlmProvider, ModelChoice, QualityTier, TaskType } from "./types";

export type RoutePlan = {
  primary: ModelChoice;
  fallbacks: ModelChoice[];
};

const FALLBACKS_BY_PROVIDER: Record<LlmProvider, ModelChoice[]> = {
  openai: [
    { provider: "anthropic", model: "claude-3-5-sonnet-latest" },
  ],
  anthropic: [
    { provider: "openai", model: "gpt-4o" },
    { provider: "openai", model: "gpt-4o-mini" },
  ],
  // No automatic fallback: NVIDIA failures should stay observable.
  nvidia: [],
};

// If a user pins provider, keep it pinned unless fallback needed.
function pinProvider(choice: ModelChoice, pinned: LlmProvider): ModelChoice {
  return { provider: pinned, model: choice.model };
}

export function buildRoutePlan(args: {
  task: TaskType;
  tier?: QualityTier;
  preference?: LlmPreference; // user override
  workspacePreference?: LlmPreference; // stored setting
}): RoutePlan {
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
      fallbacks: FALLBACKS_BY_PROVIDER[taskRoute.provider],
    };
  }

  // If pinned to provider, use taskRoute.model but provider pinned.
  const primary = pinProvider(taskRoute, pref);
  return {
    primary,
    fallbacks: FALLBACKS_BY_PROVIDER[pref],
  };
}
