import "server-only";

import { createLlmGateway } from "./gateway";
import { buildSystemPrompt, withSystem } from "./prompts";
import { createAnthropicClient } from "./providers/anthropic";
import { createNvidiaClient } from "./providers/nvidia";
import { createOpenAiClient } from "./providers/openai";
import { getUserAiPreference } from "./preferences";
import type {
  LlmGenerateInput,
  LlmMessage,
  LlmPreference,
  LlmResult,
  QualityTier,
  TaskType,
} from "./types";

let cachedGateway: ReturnType<typeof createLlmGateway> | null = null;

function getGateway() {
  if (!cachedGateway) {
    cachedGateway = createLlmGateway({
      openai: createOpenAiClient(),
      anthropic: createAnthropicClient(),
      nvidia: createNvidiaClient(),
      getUserPreference: async (userId: string) => {
        const pref = await getUserAiPreference(userId);
        return {
          preference: pref.textProvider,
          anthropicModel: pref.anthropicModel,
          openaiTextModel: pref.openaiTextModel,
        };
      },
    });
  }
  return cachedGateway;
}

export type RunGatewayArgs = {
  userId: string;
  workspaceId?: string | null;
  task: TaskType;
  tier?: QualityTier;
  prompt?: string;
  messages?: LlmMessage[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  preference?: LlmPreference;
  metadata?: Record<string, string | number | boolean | null>;
};

export async function runGateway(args: RunGatewayArgs): Promise<LlmResult> {
  const gateway = getGateway();

  const userMessages: LlmMessage[] = args.messages
    ? args.messages
    : args.prompt
    ? [{ role: "user", content: args.prompt }]
    : [];

  if (userMessages.length === 0) {
    throw new Error("runGateway requires either `prompt` or `messages`");
  }

  const system = args.systemPrompt ?? buildSystemPrompt(args.task);
  const messages = withSystem(userMessages, system);

  const input: LlmGenerateInput = {
    userId: args.userId,
    workspaceId: args.workspaceId ?? args.userId,
    task: args.task,
    tier: args.tier,
    messages,
    maxTokens: args.maxTokens,
    temperature: args.temperature,
    preference: args.preference,
    metadata: args.metadata,
  };

  return gateway.generate(input);
}
