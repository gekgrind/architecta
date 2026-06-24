import { describe, expect, it } from "vitest";

import { asSectionArray, asStringArray, extractJson } from "./json";

describe("extractJson", () => {
  it("parses a bare JSON object", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("extracts JSON from a fenced ```json block", () => {
    const text = "Here you go:\n```json\n{ \"hook\": \"hi\" }\n```\nthanks";
    expect(extractJson(text)).toEqual({ hook: "hi" });
  });

  it("extracts JSON surrounded by prose", () => {
    const text = 'Sure! {"caption":"text"} hope that helps';
    expect(extractJson(text)).toEqual({ caption: "text" });
  });

  it("tolerates trailing commas", () => {
    expect(extractJson('{"a":1,"b":2,}')).toEqual({ a: 1, b: 2 });
  });

  it("parses a top-level array", () => {
    expect(extractJson("[1, 2, 3]")).toEqual([1, 2, 3]);
  });

  it("throws when there is no JSON", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("asStringArray", () => {
  it("keeps only strings", () => {
    expect(asStringArray(["a", 1, "b", null, "c"])).toEqual(["a", "b", "c"]);
  });

  it("returns [] for non-arrays", () => {
    expect(asStringArray("nope")).toEqual([]);
    expect(asStringArray(undefined)).toEqual([]);
  });
});

describe("asSectionArray", () => {
  it("maps valid sections and drops invalid ones", () => {
    const input = [
      { title: "Pillars", items: ["one", "two"] },
      { title: "NoItems" },
      { items: ["orphan"] },
      "garbage",
    ];
    expect(asSectionArray(input)).toEqual([
      { title: "Pillars", items: ["one", "two"] },
      { title: "NoItems", items: [] },
    ]);
  });

  it("returns [] for non-arrays", () => {
    expect(asSectionArray({})).toEqual([]);
  });
});
