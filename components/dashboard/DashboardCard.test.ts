import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// `useReducedMotion` is null during SSR and true/false on the client.
const motionPreference = vi.hoisted(() => ({ reduce: null as boolean | null }));
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => motionPreference.reduce,
}));

import { DashboardCard } from "./DashboardCard";

function render(reduce: boolean | null) {
  motionPreference.reduce = reduce;
  return renderToStaticMarkup(
    createElement(
      DashboardCard,
      { title: "Action Queue" } as ComponentProps<typeof DashboardCard>,
      createElement("p", null, "Resolve 1 failed publish")
    )
  );
}

describe("DashboardCard motion preference", () => {
  afterEach(() => {
    motionPreference.reduce = null;
  });

  it("renders the same markup on the server and on a reduced-motion client", () => {
    // Any difference here is a hydration mismatch React will not patch up.
    expect(render(true)).toBe(render(null));
  });

  it("renders the same markup for normal-motion clients and keeps its content visible", () => {
    const server = render(null);
    expect(render(false)).toBe(server);
    expect(server).toContain("Action Queue");
    expect(server).toContain("Resolve 1 failed publish");
    expect(server).not.toContain("opacity:0");
  });
});
