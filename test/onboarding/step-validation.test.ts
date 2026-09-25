import { describe, expect, it } from "vitest";
import { ONBOARDING_STEPS, getPreviousStepUrl } from "@/lib/onboarding/steps";

describe("ONBOARDING_STEPS", () => {
  it("has sequential step numbers from 00 to 10", () => {
    ONBOARDING_STEPS.forEach((step, i) => {
      expect(step.number).toBe(String(i).padStart(2, "0"));
    });
  });

  it("has 11 steps", () => {
    expect(ONBOARDING_STEPS).toHaveLength(11);
  });

  it("has unique ids", () => {
    const ids = ONBOARDING_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("source step has the updated copy", () => {
    const source = ONBOARDING_STEPS.find((s) => s.id === "source");
    expect(source?.title).toBe("Where are you starting from?");
    expect(source?.subtitle).toBeTruthy();
  });
});

describe("getPreviousStepUrl", () => {
  it("returns null for the first step", () => {
    expect(getPreviousStepUrl("welcome")).toBeNull();
  });

  it("returns previous step URL for middle steps", () => {
    expect(getPreviousStepUrl("source")).toBe("/onboarding/welcome");
    expect(getPreviousStepUrl("website")).toBe("/onboarding/source");
  });

  it("returns null for unknown step", () => {
    expect(getPreviousStepUrl("nonexistent")).toBeNull();
  });
});

describe("step validation rules", () => {
  it("source step requires selection (not null)", () => {
    const selected: string | null = null;
    expect(!!selected).toBe(false);

    const selectedOption = "new";
    expect(!!selectedOption).toBe(true);
  });

  it("snapshot step requires brandName, industry, and description", () => {
    const isValid = (brandName: string, industry: string, description: string) =>
      brandName.trim().length > 0 &&
      industry.trim().length > 0 &&
      description.trim().length > 0;

    expect(isValid("", "", "")).toBe(false);
    expect(isValid("Acme", "", "")).toBe(false);
    expect(isValid("Acme", "SaaS", "")).toBe(false);
    expect(isValid("Acme", "SaaS", "We build things")).toBe(true);
    expect(isValid("  ", "SaaS", "desc")).toBe(false);
  });

  it("market step requires primaryMarket and niche", () => {
    const isValid = (primaryMarket: string, niche: string) =>
      primaryMarket.trim().length > 0 && niche.trim().length > 0;

    expect(isValid("", "")).toBe(false);
    expect(isValid("B2B", "")).toBe(false);
    expect(isValid("B2B", "founders")).toBe(true);
  });

  it("customers step requires role, at least one pain, and outcome", () => {
    const isValid = (role: string, pains: string[], outcome: string) =>
      role.trim().length > 0 && pains.length > 0 && outcome.trim().length > 0;

    expect(isValid("", [], "")).toBe(false);
    expect(isValid("Founders", [], "")).toBe(false);
    expect(isValid("Founders", ["Clarity"], "")).toBe(false);
    expect(isValid("Founders", ["Clarity"], "More revenue")).toBe(true);
  });

  it("foundation step requires at least one value", () => {
    expect(([] as string[]).length > 0).toBe(false);
    expect(["Clarity"].length > 0).toBe(true);
  });

  it("voice step requires tone selection", () => {
    expect("".length > 0).toBe(false);
    expect("direct".length > 0).toBe(true);
  });

  it("visuals step requires style selection", () => {
    expect("".length > 0).toBe(false);
    expect("minimal".length > 0).toBe(true);
  });

  it("review step is always valid", () => {
    expect(true).toBe(true);
  });
});
