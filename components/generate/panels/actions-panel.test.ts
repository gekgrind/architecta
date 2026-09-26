import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ActionsPanel } from "./actions-panel";

const render = (props: Partial<Parameters<typeof ActionsPanel>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(ActionsPanel, {
      hasContent: true,
      contentScore: null,
      content: "Some content",
      onSave: () => {},
      ...props,
    })
  );

describe("ActionsPanel Save button", () => {
  it("does not claim Saved! until the server confirmed the save", () => {
    const html = render();
    expect(html).toContain("Save to Library");
    expect(html).not.toContain("Saved!");
  });

  it("shows an in-flight state and disables Save while persisting", () => {
    const html = render({ isSaving: true });
    expect(html).toContain("Saving...");
    expect(html).not.toContain("Saved!");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Saving\.\.\./s);
  });

  it("shows Saved! only when told the current content is persisted", () => {
    expect(render({ isSaved: true })).toContain("Saved!");
  });

  it("is disabled when there is no save handler (no persisted post)", () => {
    const html = render({ onSave: undefined });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Save to Library/s);
  });

  it("no longer shows fake version history", () => {
    const html = render();
    expect(html).not.toContain("Version History");
    expect(html).not.toContain("Restore");
  });
});
