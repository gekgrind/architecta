import "server-only";

import { isAllowedVideoModel, isPaidAiDisabled } from "../policy";

export class VideoNotAvailableError extends Error {
  status: number;
  raw: unknown;
  constructor(message: string, status: number, raw: unknown) {
    super(message);
    this.name = "VideoNotAvailableError";
    this.status = status;
    this.raw = raw;
  }
}

export type GenerateVideoInput = {
  prompt: string;
  model?: string;
  durationSeconds?: number;
};

export type GenerateVideoResult = {
  provider: "openai";
  model: string;
  /** Raw bytes for the produced video (mp4). */
  bytes: Uint8Array;
  mimeType: "video/mp4";
  durationSeconds: number;
  latencyMs: number;
  requestId: string | null;
};

type SoraJobResponse = {
  id?: string;
  status?: string;
  error?: { message?: string };
  // The exact shape of Sora responses is account-tier dependent; we treat any
  // non-OK status as "not available" and let the route fall back.
  asset?: { download_url?: string };
  output?: { url?: string };
};

const SORA_ENDPOINT = "https://api.openai.com/v1/videos";

/**
 * Best-effort Sora video generation. If the account doesn't have access (the
 * common case today) this throws `VideoNotAvailableError` and the caller is
 * expected to fall back to a storyboard JSON.
 */
export async function generateVideo(
  input: GenerateVideoInput
): Promise<GenerateVideoResult> {
  // Checked before anything else: test mode must never reach Sora. The route
  // treats this like any unavailable video provider (storyboard fallback).
  if (isPaidAiDisabled()) {
    throw new VideoNotAvailableError("Video generation is disabled in AI test mode", 503, null);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  if (process.env.ARCHITECTA_VIDEO_DISABLED === "1") {
    throw new VideoNotAvailableError(
      "Video generation disabled via ARCHITECTA_VIDEO_DISABLED",
      503,
      null
    );
  }

  const model = input.model || "sora-2";
  if (!isAllowedVideoModel(model)) {
    throw new VideoNotAvailableError("Unsupported video model", 400, null);
  }
  const durationSeconds = input.durationSeconds ?? 8;
  const started = Date.now();

  let res: Response;
  try {
    res = await fetch(SORA_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: input.prompt,
        duration_seconds: durationSeconds,
      }),
    });
  } catch (err) {
    throw new VideoNotAvailableError(
      err instanceof Error ? err.message : "Network error contacting video API",
      0,
      err
    );
  }

  if (!res.ok) {
    let raw: unknown = null;
    try {
      raw = await res.json();
    } catch {
      // ignore
    }
    const msg =
      (raw as { error?: { message?: string } } | null)?.error?.message ||
      `OpenAI video error (${res.status})`;
    throw new VideoNotAvailableError(msg, res.status, raw);
  }

  const json = (await res.json()) as SoraJobResponse;
  const downloadUrl = json.asset?.download_url || json.output?.url;
  if (!downloadUrl) {
    throw new VideoNotAvailableError(
      "Video job did not return a downloadable URL",
      502,
      json
    );
  }

  const downloadRes = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!downloadRes.ok) {
    throw new VideoNotAvailableError(
      `Failed to download video (${downloadRes.status})`,
      downloadRes.status,
      null
    );
  }
  const buf = new Uint8Array(await downloadRes.arrayBuffer());

  return {
    provider: "openai",
    model,
    bytes: buf,
    mimeType: "video/mp4",
    durationSeconds,
    latencyMs: Date.now() - started,
    requestId: res.headers.get("x-request-id"),
  };
}

export type Storyboard = {
  summary: string;
  shots: Array<{
    index: number;
    durationSeconds: number;
    visual: string;
    onScreenText?: string;
    voiceover?: string;
    bRoll?: string;
  }>;
  totalDurationSeconds: number;
  recommendedAspectRatio: "9:16" | "1:1" | "16:9";
  suggestedMusic?: string;
};

export function buildStoryboardPrompt(input: GenerateVideoInput): string {
  const duration = input.durationSeconds ?? 8;
  return [
    "You are a senior short-form video director.",
    "Produce a tight, production-ready storyboard for the following concept.",
    "Return STRICT JSON only, no commentary, matching this schema:",
    "{",
    '  "summary": string,',
    '  "shots": [',
    '    {"index": number, "durationSeconds": number, "visual": string,',
    '     "onScreenText": string, "voiceover": string, "bRoll": string}',
    "  ],",
    '  "totalDurationSeconds": number,',
    '  "recommendedAspectRatio": "9:16" | "1:1" | "16:9",',
    '  "suggestedMusic": string',
    "}",
    `Target total duration: ~${duration} seconds. 3-5 shots is ideal.`,
    "",
    `Concept: ${input.prompt}`,
  ].join("\n");
}
