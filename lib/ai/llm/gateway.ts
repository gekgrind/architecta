import type {
  LlmClient,
  LlmGenerateInput,
  LlmPreference,
  LlmProvider,
  LlmResult,
} from "./types";
import {
  AiGatewayError,
  allowsFallback,
  classifyLlmError,
  errorStatus,
  isRetryableCategory,
  type LlmErrorCategory,
} from "./errors";
import { getAiTestProvider, isAllowedTextModel, resolveMaxTokens } from "./policy";
import { buildRoutePlan } from "./router";
import { logLlmCall } from "./usage/logger";

type UserPreferenceLookup = (userId: string) => Promise<{
  preference: LlmPreference;
  anthropicModel?: string;
  openaiTextModel?: string;
}>;

type GatewayDeps = {
  openai: LlmClient;
  anthropic: LlmClient;
  nvidia: LlmClient;
  getUserPreference: UserPreferenceLookup;
  /** Backoff before a same-provider retry; injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
};

/** Attempts on the primary step (1 call + 1 retry on transient failures). */
export const MAX_PRIMARY_ATTEMPTS = 2;
/** Attempts on each fallback step (no retries). */
export const MAX_FALLBACK_ATTEMPTS = 1;

function getClient(deps: GatewayDeps, provider: LlmProvider): LlmClient {
  if (provider === "nvidia") return deps.nvidia;
  return provider === "openai" ? deps.openai : deps.anthropic;
}

async function defaultSleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function logAttemptFailure(args: {
  input: LlmGenerateInput;
  provider: LlmProvider;
  model: string;
  attempt: number;
  category: LlmErrorCategory;
  status?: number;
}) {
  // Non-secret diagnostics only: no prompts, no provider response text.
  console.warn("[llm] attempt failed", {
    userId: args.input.userId,
    task: args.input.task,
    provider: args.provider,
    model: args.model,
    attempt: args.attempt,
    category: args.category,
    status: args.status ?? null,
    at: new Date().toISOString(),
  });
}

export function createLlmGateway(deps: GatewayDeps) {
  const sleep = deps.sleep ?? defaultSleep;

  return {
    async generate(input: LlmGenerateInput): Promise<LlmResult> {
      const userId = input.userId;
      if (!userId) {
        throw new Error("LLM gateway requires userId in input");
      }

      const testProvider = getAiTestProvider();
      if (testProvider === "invalid") {
        console.error("[llm] AI_TEST_PROVIDER has an unsupported value; refusing AI calls");
        throw new AiGatewayError("configuration");
      }
      const nvidiaOnly = testProvider === "nvidia";

      // In NVIDIA-only mode stored preferences are irrelevant — skip the lookup.
      const pref = nvidiaOnly ? null : await deps.getUserPreference(userId);

      const plan = buildRoutePlan({
        task: input.task,
        tier: input.tier,
        preference: input.preference,
        workspacePreference: pref?.preference,
        userModels: {
          anthropic: pref?.anthropicModel,
          openai: pref?.openaiTextModel,
        },
        nvidiaOnly,
      });

      const routeReason = nvidiaOnly
        ? "test_provider:nvidia"
        : input.preference
        ? `user_override:${input.preference}`
        : `user_pref:${pref?.preference ?? "auto"}`;

      const chain = [plan.primary, ...plan.fallbacks];

      // Defense in depth: nothing outside the allowlist (or outside NVIDIA in
      // test mode) is ever forwarded to a provider.
      for (const step of chain) {
        if (nvidiaOnly && step.provider !== "nvidia") {
          throw new AiGatewayError("configuration");
        }
        if (!isAllowedTextModel(step.provider, step.model)) {
          console.error("[llm] refusing non-allowlisted model", {
            provider: step.provider,
            model: step.model,
          });
          throw new AiGatewayError("configuration");
        }
      }

      const maxTokens = resolveMaxTokens(input.task, input.maxTokens);

      let lastErr: unknown = null;
      let lastCategory: LlmErrorCategory = "unknown";
      let lastProvider: LlmProvider | undefined;
      let attemptNumber = 0;

      steps: for (let i = 0; i < chain.length; i++) {
        const step = chain[i];
        const isFallback = i > 0;
        const maxAttempts = isFallback ? MAX_FALLBACK_ATTEMPTS : MAX_PRIMARY_ATTEMPTS;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          attemptNumber += 1;
          try {
            if (attempt > 1) await sleep(250 * attempt);

            const result = await getClient(deps, step.provider).generate({
              ...input,
              maxTokens,
              model: step.model,
            });

            const final: LlmResult = {
              ...result,
              usedFallback: isFallback,
            };

            await logLlmCall({ input, result: final, routeReason, attempt: attemptNumber });

            return final;
          } catch (err: unknown) {
            lastErr = err;
            lastCategory = classifyLlmError(err);
            lastProvider = step.provider;
            logAttemptFailure({
              input,
              provider: step.provider,
              model: step.model,
              attempt: attemptNumber,
              category: lastCategory,
              status: errorStatus(err),
            });

            if (isRetryableCategory(lastCategory) && attempt < maxAttempts) continue;
            if (allowsFallback(lastCategory)) continue steps;
            break steps;
          }
        }
      }

      throw new AiGatewayError(lastCategory, {
        status: errorStatus(lastErr),
        provider: lastProvider,
        cause: lastErr,
      });
    },
  };
}
