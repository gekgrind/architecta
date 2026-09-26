import { describe, expect, it } from "vitest";

import { buildPostText, type PostForPublish } from "./publish";
import { composePostText, toPostContentPatch, type PostTextFields } from "./post-text";

const saved: PostTextFields = {
  hook: "Hook line.",
  caption: "Caption copy.",
  body: "Caption copy.",
  cta: "Book a call.",
  hashtags: ["growth", "#founders"],
};

/** The stored post after a PATCH: patched fields over the previously saved ones. */
const asPublishable = (fields: object) =>
  ({ ...saved, ...fields, id: "p", user_id: "u", platform: "linkedin" }) as unknown as PostForPublish;

describe("composePostText", () => {
  it("matches the text the publisher sends", () => {
    expect(composePostText(saved)).toBe("Hook line.\n\nCaption copy.\n\nBook a call.\n\n#growth #founders");
    expect(buildPostText(asPublishable(saved))).toBe(composePostText(saved));
  });
});

describe("toPostContentPatch", () => {
  const cases: Array<[string, string]> = [
    ["unchanged", composePostText(saved)],
    ["caption edited", "Hook line.\n\nNew caption.\n\nBook a call.\n\n#growth #founders"],
    ["hook edited", "New hook.\n\nCaption copy.\n\nBook a call.\n\n#growth #founders"],
    ["hashtags edited", "Hook line.\n\nCaption copy.\n\nBook a call.\n\n#growth"],
    ["everything replaced", "Completely rewritten post."],
    ["only hook kept", "Hook line."],
    ["blank-line padding", "Hook line.\n\n\n\nBook a call."],
    ["surrounding whitespace", "  Hook line.\n\nCaption copy.  \n"],
  ];

  it.each(cases)("%s: what is saved publishes exactly as typed", (_label, edited) => {
    const patch = toPostContentPatch(edited, saved);
    expect(buildPostText(asPublishable(patch))).toBe(edited.trim());
    expect(composePostText({ ...patch, body: patch.body ?? saved.body }).trim()).toBe(edited.trim());
  });

  it("keeps untouched hook / CTA / hashtags as structured fields", () => {
    const patch = toPostContentPatch(
      "Hook line.\n\nNew caption.\n\nBook a call.\n\n#growth #founders",
      saved
    );
    expect(patch).toEqual({
      hook: "Hook line.",
      caption: "New caption.",
      cta: "Book a call.",
      hashtags: ["growth", "#founders"],
      body: "New caption.",
    });
  });

  it("does not overwrite a separate long-form body", () => {
    const patch = toPostContentPatch("Hook line.\n\nNew caption.", {
      ...saved,
      body: "A much longer blog expansion.",
    });
    expect(patch.body).toBeUndefined();
    expect(patch.caption).toBe("New caption.");
  });

  it("writes body when the editor was showing body (no caption)", () => {
    const patch = toPostContentPatch("Edited body.", { ...saved, caption: null, body: "Old body." });
    expect(patch.caption).toBe("Edited body.");
    expect(patch.body).toBe("Edited body.");
  });
});
