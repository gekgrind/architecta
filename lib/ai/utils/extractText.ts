import type { ContentBlock } from "@anthropic-ai/sdk/resources/messages";

export function extractClaudeText(content: ContentBlock[]) {
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}
