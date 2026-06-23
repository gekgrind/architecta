import type {
  LlmClient,
  LlmGenerateInput,
  LlmPreference,
  LlmProvider,
  LlmResult,
} from "./types";
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
  getUserPreference: UserPreferenceLookup;
};

function getClient(deps: GatewayDeps, provider: LlmProvider): LlmClient {
  return provider === "openai" ? deps.openai : deps.anthropic;
}

function getErrorStatus(err: unknown): number | undefined {
  return typeof err === "object" && err !== null && "status" in err
    ? Number((err as { status?: unknown }).status)
    : undefined;
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "LLM request failed";
}

function isRetryable(err: unknown): boolean {
  const status = getErrorStatus(err);
  if (!status) return true;
  return status === 429 || (status >= 500 && status <= 599);
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function attemptGenerate(args: {
  deps: GatewayDeps;
  input: LlmGenerateInput;
  provider: LlmProvider;
  model: string;
}): Promise<LlmResult> {
  const client = getClient(args.deps, args.provider);
  return client.generate({
    ...args.input,
    model: args.model,
  });
}

export function createLlmGateway(deps: GatewayDeps) {
  return {
    async generate(input: LlmGenerateInput): Promise<LlmResult> {
      const userId = input.userId;
      if (!userId) {
        throw new Error("LLM gateway requires userId in input");
      }

      const pref = await deps.getUserPreference(userId);

      const plan = buildRoutePlan({
        task: input.task,
        tier: input.tier,
        preference: input.preference,
        workspacePreference: pref.preference,
      });

      // Apply user model overrides when their pinned provider matches the step.
      const applyOverride = (
        step: { provider: LlmProvider; model: string }
      ) => {
        if (step.provider === "anthropic" && pref.anthropicModel) {
          return { ...step, model: pref.anthropicModel };
        }
        if (step.provider === "openai" && pref.openaiTextModel) {
          return { ...step, model: pref.openaiTextModel };
        }
        return step;
      };

      const routeReason = input.preference
        ? `user_override:${input.preference}`
        : `user_pref:${pref.preference}`;

      const chain = [plan.primary, ...plan.fallbacks].map(applyOverride);

      let lastErr: unknown = null;

      for (let i = 0; i < chain.length; i++) {
        const step = chain[i];
        const isFallback = i > 0;

        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            if (attempt > 1) await sleep(250 * attempt);

            const result = await attemptGenerate({
              deps,
              input,
              provider: step.provider,
              model: step.model,
            });

            const final: LlmResult = {
              ...result,
              usedFallback: isFallback,
            };

            await logLlmCall({ input, result: final, routeReason });

            return final;
          } catch (err: unknown) {
            lastErr = err;
            if (!isRetryable(err) || attempt === 2) break;
          }
        }
      }

      const e = Object.assign(new Error(getErrorMessage(lastErr)), {
        raw:
          typeof lastErr === "object" && lastErr !== null && "raw" in lastErr
            ? (lastErr as { raw?: unknown }).raw
            : undefined,
        status: getErrorStatus(lastErr),
      });
      throw e;
    },
  };
}
