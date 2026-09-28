import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// `useReducedMotion` is null during SSR and true/false on the client.
const motionPreference = vi.hoisted(() => ({ reduce: null as boolean | null }));
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => motionPreference.reduce,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/strategy-engine",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/config/ecosystem", () => ({
  getCommandCenterUrl: () => "https://entrepreneuria.io/dashboard",
}));
vi.mock("@/hooks/use-auth-identity", () => ({
  useAuthIdentity: () => ({
    avatarUrl: null,
    displayName: "Misti",
    loading: false,
    title: null,
    user: null,
    workspaceName: "Northwind",
  }),
}));
vi.mock("@/components/strategy-engine/strategy-engine-workflow", () => ({
  StrategyEngineWorkflow: () => createElement("section", null, "Strategy brief"),
}));

import { StrategyEngineShell } from "./strategy-engine-shell";

function render(reduce: boolean | null) {
  motionPreference.reduce = reduce;
  return renderToStaticMarkup(createElement(StrategyEngineShell));
}

describe("StrategyEngineShell motion preference", () => {
  afterEach(() => {
    motionPreference.reduce = null;
  });

  it("renders the same markup on the server and on a reduced-motion client", () => {
    // A reduced-motion client that renders differently keeps the server's
    // hidden entrance styles forever — the workspace stays invisible.
    expect(render(true)).toBe(render(null));
  });

  it("renders the same markup for normal-motion clients and includes the workspace", () => {
    const server = render(null);
    expect(render(false)).toBe(server);
    expect(server).toContain("Strategy brief");
  });
});
