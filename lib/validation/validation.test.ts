import { describe, expect, it } from "vitest";

import { userSettingsPatchSchema } from "./settings";
import { imageGenerateInputSchema, videoGenerateInputSchema } from "./asset";
import { postGenerateInputSchema } from "./post";
import { campaignGenerateInputSchema } from "./campaign";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("userSettingsPatchSchema", () => {
  it("accepts a partial patch", () => {
    const parsed = userSettingsPatchSchema.safeParse({ textProvider: "openai" });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown provider", () => {
    const parsed = userSettingsPatchSchema.safeParse({ textProvider: "gemini" });
    expect(parsed.success).toBe(false);
  });

  it("rejects an unknown platform in defaultPlatforms", () => {
    const parsed = userSettingsPatchSchema.safeParse({
      defaultPlatforms: ["linkedin", "myspace"],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("imageGenerateInputSchema", () => {
  it("applies defaults for size/quality/model", () => {
    const parsed = imageGenerateInputSchema.safeParse({ prompt: "a cat" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.size).toBe("1024x1024");
      expect(parsed.data.quality).toBe("high");
      expect(parsed.data.model).toBe("gpt-image-1");
    }
  });

  it("rejects an empty prompt", () => {
    expect(imageGenerateInputSchema.safeParse({ prompt: "" }).success).toBe(false);
  });

  it("rejects an invalid size", () => {
    const parsed = imageGenerateInputSchema.safeParse({ prompt: "x", size: "999x999" });
    expect(parsed.success).toBe(false);
  });

  it("rejects a non-uuid postId", () => {
    const parsed = imageGenerateInputSchema.safeParse({ prompt: "x", postId: "nope" });
    expect(parsed.success).toBe(false);
  });
});

describe("videoGenerateInputSchema", () => {
  it("defaults duration to 8 and model to sora-2", () => {
    const parsed = videoGenerateInputSchema.safeParse({ prompt: "a clip" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.durationSeconds).toBe(8);
      expect(parsed.data.model).toBe("sora-2");
    }
  });

  it("rejects duration outside 2..60", () => {
    expect(videoGenerateInputSchema.safeParse({ prompt: "x", durationSeconds: 1 }).success).toBe(false);
    expect(videoGenerateInputSchema.safeParse({ prompt: "x", durationSeconds: 61 }).success).toBe(false);
  });
});

describe("postGenerateInputSchema", () => {
  it("accepts a minimal valid post and applies defaults", () => {
    const parsed = postGenerateInputSchema.safeParse({
      platform: "linkedin",
      topic: "Launching our new feature",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.length).toBe("medium");
      expect(parsed.data.includeCta).toBe(true);
      expect(parsed.data.keyPoints).toEqual([]);
    }
  });

  it("rejects an unknown platform", () => {
    const parsed = postGenerateInputSchema.safeParse({ platform: "fax", topic: "hi" });
    expect(parsed.success).toBe(false);
  });

  it("rejects an empty topic", () => {
    const parsed = postGenerateInputSchema.safeParse({ platform: "x", topic: "" });
    expect(parsed.success).toBe(false);
  });

  it("accepts a nullable workspaceId but rejects a malformed one", () => {
    expect(
      postGenerateInputSchema.safeParse({ platform: "x", topic: "hi", workspaceId: null }).success
    ).toBe(true);
    expect(
      postGenerateInputSchema.safeParse({ platform: "x", topic: "hi", workspaceId: "abc" }).success
    ).toBe(false);
    expect(
      postGenerateInputSchema.safeParse({ platform: "x", topic: "hi", workspaceId: UUID }).success
    ).toBe(true);
  });
});

describe("campaignGenerateInputSchema", () => {
  it("accepts a valid brief", () => {
    const parsed = campaignGenerateInputSchema.safeParse({
      name: "Spring launch",
      theme: "Renewal",
      goal: "Drive signups",
      platforms: ["linkedin", "instagram"],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.postsPerPlatform).toBe(3);
      expect(parsed.data.includeEmail).toBe(true);
    }
  });

  it("requires at least one platform", () => {
    const parsed = campaignGenerateInputSchema.safeParse({
      name: "x",
      theme: "y",
      goal: "z",
      platforms: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    expect(
      campaignGenerateInputSchema.safeParse({ name: "x", platforms: ["x"] }).success
    ).toBe(false);
  });
});
