import type { LlmClient, LlmGenerateInput, LlmResult, LlmProvider } from "./types";
import { buildRoutePlan } from "./router";
import { logLlmCall } from "./usage/logger";

type GatewayDeps = {
  openai: LlmClient;
  anthropic: LlmClient;

  // You’ll wire this to Supabase: fetch workspace preference and any limits.
  getWorkspacePreference: (workspaceId: string) => Promise<{
    preference: "auto" | LlmProvider;
  }>;
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
  // 429 / 5xx are usually retryable. Also allow network errors.
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
  attempt: number;
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
      const ws = await deps.getWorkspacePreference(input.workspaceId);

      const plan = buildRoutePlan({
        task: input.task,
        tier: input.tier,
        preference: input.preference, // user override
        workspacePreference: ws.preference, // stored setting
      });

      const routeReason =
        input.preference ? `user_override:${input.preference}` : `workspace:${ws.preference}`;

      const chain = [plan.primary, ...plan.fallbacks];

      let lastErr: unknown = null;

      for (let i = 0; i < chain.length; i++) {
        const step = chain[i];
        const isFallback = i > 0;

        // one retry for primary/fallback if retryable
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            if (attempt > 1) await sleep(250 * attempt);

            const result = await attemptGenerate({
              deps,
              input,
              provider: step.provider,
              model: step.model,
              attempt,
            });

            const final: LlmResult = {
              ...result,
              usedFallback: isFallback ? true : false,
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
