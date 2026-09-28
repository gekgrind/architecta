import { describe, expect, it } from "vitest";

import { strategyEnginePrefillFromProfile } from "@/lib/strategy/strategy-engine";

import { brandKitPrefillFromProfile, mergeBrandKitPrefill } from "./prefill";

const blankForm = {
  brandName: "",
  industry: "",
  website: "",
  description: "",
  demographics: "",
  painPoints: [""],
  goals: [""],
  toneAttributes: [] as string[],
  voiceDescription: "",
  topicsInclude: [] as string[],
  topicsAvoid: [] as string[],
  bannedPhrases: [] as string[],
  requiredElements: [] as string[],
  examplePosts: [] as Array<{ id: string; type: string; content?: string }>,
};

describe("brandKitPrefillFromProfile", () => {
  it("maps onboarding-created profile fields onto the wizard", () => {
    const prefill = brandKitPrefillFromProfile({
      brandName: "Northwind Studio",
      industry: "Brand design",
      website: "https://northwind.studio",
      description: "Brand sprints",
      audience: "Seed founders",
      toneVoice: "Confident, bold, balanced authority",
      topics: { include: ["positioning"], avoid: ["hype"] },
      bannedPhrases: ["synergy"],
      requiredElements: ["positioning"],
      examplePosts: [{ id: "p1", type: "linkedin", content: "Hello", whyItWorks: "Short" }, { id: "bad" }],
    });

    expect(prefill).toEqual({
      brandName: "Northwind Studio",
      industry: "Brand design",
      website: "https://northwind.studio",
      description: "Brand sprints",
      demographics: "Seed founders",
      toneAttributes: ["Confident", "bold", "balanced authority"],
      topicsInclude: ["positioning"],
      topicsAvoid: ["hype"],
      bannedPhrases: ["synergy"],
      requiredElements: ["positioning"],
      examplePosts: [{ id: "p1", type: "linkedin", content: "Hello", whyItWorks: "Short" }],
    });
  });

  it("omits unknown fields rather than returning empty values", () => {
    expect(brandKitPrefillFromProfile(null)).toEqual({});
    expect(brandKitPrefillFromProfile({ brandName: "  ", topics: null })).toEqual({});
  });

  it("only fills fields the user has not typed into", () => {
    const merged = mergeBrandKitPrefill(
      { ...blankForm, brandName: "Typed by user" },
      { brandName: "From profile", demographics: "Seed founders", painPoints: undefined } as never
    );
    expect(merged.brandName).toBe("Typed by user");
    expect(merged.demographics).toBe("Seed founders");
    expect(merged.painPoints).toEqual([""]);
  });
});

describe("strategyEnginePrefillFromProfile", () => {
  it("seeds niche, audience and offer from the saved profile", () => {
    expect(
      strategyEnginePrefillFromProfile({
        brandName: "Northwind Studio",
        industry: "Brand design",
        audience: "Seed founders",
        offers: "Two-week brand sprint",
      })
    ).toEqual({
      businessNiche: "Northwind Studio — Brand design",
      audience: "Seed founders",
      offer: "Two-week brand sprint",
    });
  });

  it("falls back sensibly and never invents goal or challenge", () => {
    const prefill = strategyEnginePrefillFromProfile({
      description: "Brand sprints for founders",
      typicalCustomers: "Solo founders",
    });
    expect(prefill).toEqual({
      businessNiche: "Brand sprints for founders",
      audience: "Solo founders",
      offer: "Brand sprints for founders",
    });
    expect(prefill).not.toHaveProperty("primaryGoal");
    expect(strategyEnginePrefillFromProfile(null)).toEqual({});
  });
});
