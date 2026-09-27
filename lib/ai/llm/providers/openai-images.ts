import "server-only";

import { isAllowedImageModel, isPaidAiDisabled } from "../policy";

/** Image generation is OpenAI-only; it is switched off in AI test mode. */
export class ImageGenerationUnavailableError extends Error {
  constructor(message = "Image generation is not available in AI test mode") {
    super(message);
    this.name = "ImageGenerationUnavailableError";
  }
}

export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024" | "auto";
export type ImageQuality = "low" | "medium" | "high" | "auto";

export type GenerateImageInput = {
  prompt: string;
  model?: string;
  size?: ImageSize;
  quality?: ImageQuality;
};

export type GenerateImageResult = {
  provider: "openai";
  model: string;
  base64: string;
  mimeType: "image/png";
  width: number | null;
  height: number | null;
  latencyMs: number;
  requestId: string | null;
};

type OpenAiImageResponse = {
  data?: Array<{ b64_json?: string; url?: string }>;
  error?: { message?: string };
};

function parseDimensions(size: ImageSize): { width: number | null; height: number | null } {
  if (size === "auto") return { width: null, height: null };
  const [w, h] = size.split("x").map((n) => Number.parseInt(n, 10));
  return {
    width: Number.isFinite(w) ? w : null,
    height: Number.isFinite(h) ? h : null,
  };
}

export async function generateImage(
  input: GenerateImageInput
): Promise<GenerateImageResult> {
  // Checked before anything else: test mode must never reach OpenAI.
  if (isPaidAiDisabled()) throw new ImageGenerationUnavailableError();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const model = input.model || "gpt-image-1";
  if (!isAllowedImageModel(model)) throw new Error("Unsupported image model");
  const size: ImageSize = input.size ?? "1024x1024";
  const quality: ImageQuality = input.quality ?? "high";

  const started = Date.now();

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: input.prompt,
      n: 1,
      size,
      quality,
    }),
  });

  const json = (await res.json()) as OpenAiImageResponse;

  if (!res.ok) {
    const err = Object.assign(
      new Error(json.error?.message || `OpenAI image error (${res.status})`),
      { status: res.status, raw: json }
    );
    throw err;
  }

  const b64 = json.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI image response did not include base64 data");
  }

  const { width, height } = parseDimensions(size);

  return {
    provider: "openai",
    model,
    base64: b64,
    mimeType: "image/png",
    width,
    height,
    latencyMs: Date.now() - started,
    requestId: res.headers.get("x-request-id"),
  };
}
