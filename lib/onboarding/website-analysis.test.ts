import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  runGateway: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/ai/llm/run", () => ({ runGateway: h.runGateway }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: h.createSupabaseServerClient,
}));

import { isUnsafeUrl, extractStructuredSignals, discoverCandidateLinks } from "./website-analysis";

/* =======================================================
   SSRF Protection
======================================================= */

describe("isUnsafeUrl", () => {
  it("rejects localhost", () => {
    expect(isUnsafeUrl("http://localhost/foo")).not.toBeNull();
  });

  it("rejects 127.0.0.1", () => {
    expect(isUnsafeUrl("http://127.0.0.1/")).not.toBeNull();
  });

  it("rejects 0.0.0.0", () => {
    expect(isUnsafeUrl("http://0.0.0.0/")).not.toBeNull();
  });

  it("rejects private 10.x range", () => {
    expect(isUnsafeUrl("http://10.0.0.1/admin")).not.toBeNull();
  });

  it("rejects private 172.16.x range", () => {
    expect(isUnsafeUrl("http://172.16.0.1/")).not.toBeNull();
  });

  it("rejects private 192.168.x range", () => {
    expect(isUnsafeUrl("http://192.168.1.1/")).not.toBeNull();
  });

  it("rejects link-local 169.254.x range", () => {
    expect(isUnsafeUrl("http://169.254.169.254/latest/meta-data")).not.toBeNull();
  });

  it("rejects metadata.google.internal", () => {
    expect(isUnsafeUrl("http://metadata.google.internal/")).not.toBeNull();
  });

  it("rejects IPv6 loopback", () => {
    expect(isUnsafeUrl("http://[::1]/")).not.toBeNull();
  });

  it("rejects fe80 link-local IPv6", () => {
    expect(isUnsafeUrl("http://[fe80::1]/")).not.toBeNull();
  });

  it("rejects ftp protocol", () => {
    expect(isUnsafeUrl("ftp://example.com/file")).not.toBeNull();
  });

  it("rejects file protocol", () => {
    expect(isUnsafeUrl("file:///etc/passwd")).not.toBeNull();
  });

  it("rejects URLs with credentials", () => {
    expect(isUnsafeUrl("http://admin:pass@example.com/")).not.toBeNull();
  });

  it("rejects invalid URLs", () => {
    expect(isUnsafeUrl("not-a-url")).not.toBeNull();
  });

  it("allows valid public URLs", () => {
    expect(isUnsafeUrl("https://example.com")).toBeNull();
  });

  it("allows valid public URLs with paths", () => {
    expect(isUnsafeUrl("https://www.entrepreneuria.io/about")).toBeNull();
  });

  it("allows http protocol", () => {
    expect(isUnsafeUrl("http://example.com")).toBeNull();
  });

  it("rejects mapped IPv4 in IPv6", () => {
    expect(isUnsafeUrl("http://[::ffff:127.0.0.1]/")).not.toBeNull();
    expect(isUnsafeUrl("http://[::ffff:10.0.0.1]/")).not.toBeNull();
    expect(isUnsafeUrl("http://[::ffff:192.168.1.1]/")).not.toBeNull();
  });
});

/* =======================================================
   Structured Data Extraction
======================================================= */

describe("extractStructuredSignals", () => {
  it("extracts OpenGraph site name and description", () => {
    const html = `<html><head>
      <meta property="og:site_name" content="Acme Studio">
      <meta property="og:description" content="We build growth engines for founders.">
    </head><body></body></html>`;

    const signals = extractStructuredSignals(html);
    expect(signals.ogSiteName).toBe("Acme Studio");
    expect(signals.ogDescription).toBe("We build growth engines for founders.");
  });

  it("extracts the meta description regardless of attribute order", () => {
    const html = `<meta content="Reversed attribute order description." name="description">`;
    expect(extractStructuredSignals(html).metaDescription).toBe("Reversed attribute order description.");
  });

  it("extracts an Organization JSON-LD block", () => {
    const html = `<script type="application/ld+json">
      {"@context":"https://schema.org","@type":"Organization","name":"Acme Growth Studio","description":"Content systems for SaaS founders.","sameAs":["https://twitter.com/acme","https://linkedin.com/company/acme"]}
    </script>`;

    const signals = extractStructuredSignals(html);
    expect(signals.jsonLdOrgName).toBe("Acme Growth Studio");
    expect(signals.jsonLdOrgDescription).toBe("Content systems for SaaS founders.");
    expect(signals.jsonLdSameAs).toEqual(["https://twitter.com/acme", "https://linkedin.com/company/acme"]);
  });

  it("extracts JSON-LD nested inside an @graph array", () => {
    const html = `<script type="application/ld+json">
      {"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"ignored"},{"@type":"LocalBusiness","name":"Acme Local","description":"Neighborhood bakery."}]}
    </script>`;

    const signals = extractStructuredSignals(html);
    expect(signals.jsonLdOrgName).toBe("Acme Local");
    expect(signals.jsonLdOrgDescription).toBe("Neighborhood bakery.");
  });

  it("extracts Product/Service/Offer names", () => {
    const html = `<script type="application/ld+json">[
      {"@type":"Product","name":"Brand Kit Generator"},
      {"@type":"Service","name":"Content Strategy Call"}
    ]</script>`;

    const signals = extractStructuredSignals(html);
    expect(signals.jsonLdOfferNames).toEqual(["Brand Kit Generator", "Content Strategy Call"]);
  });

  it("extracts FAQPage questions", () => {
    const html = `<script type="application/ld+json">
      {"@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What do you offer?"},{"@type":"Question","name":"How much does it cost?"}]}
    </script>`;

    const signals = extractStructuredSignals(html);
    expect(signals.jsonLdFaqQuestions).toEqual(["What do you offer?", "How much does it cost?"]);
  });

  it("ignores malformed JSON-LD instead of throwing", () => {
    const html = `<script type="application/ld+json">{ this is not valid json }</script>
      <meta name="description" content="Still readable.">`;

    expect(() => extractStructuredSignals(html)).not.toThrow();
    expect(extractStructuredSignals(html).metaDescription).toBe("Still readable.");
  });

  it("returns an empty signal set for a page with no structured data", () => {
    const signals = extractStructuredSignals("<html><body><p>Nothing here.</p></body></html>");
    expect(signals.ogSiteName).toBeUndefined();
    expect(signals.jsonLdOrgName).toBeUndefined();
    expect(signals.metaDescription).toBeUndefined();
  });

  it("caps sameAs/offer/FAQ lists instead of growing unbounded", () => {
    const sameAs = Array.from({ length: 20 }, (_, i) => `https://example.com/social-${i}`);
    const html = `<script type="application/ld+json">{"@type":"Organization","name":"Acme","sameAs":${JSON.stringify(sameAs)}}</script>`;

    expect(extractStructuredSignals(html).jsonLdSameAs).toHaveLength(8);
  });
});

/* =======================================================
   Bounded Same-Origin Page Discovery
======================================================= */

describe("discoverCandidateLinks", () => {
  const BASE = "https://acme.example.com/";

  it("finds same-origin links whose text matches high-value page categories", () => {
    const html = `
      <nav>
        <a href="/about">About us</a>
        <a href="/pricing">Pricing</a>
        <a href="/blog">Blog</a>
      </nav>`;

    const candidates = discoverCandidateLinks(html, BASE);
    expect(candidates.map((c) => c.key)).toEqual(["about", "pricing"]);
    expect(candidates.map((c) => c.url)).toEqual([
      "https://acme.example.com/about",
      "https://acme.example.com/pricing",
    ]);
  });

  it("rejects external links even when the text matches a category", () => {
    const html = `<a href="https://competitor.com/about">About</a>`;
    expect(discoverCandidateLinks(html, BASE)).toEqual([]);
  });

  it("rejects unsafe/private candidate URLs", () => {
    const html = `<a href="http://169.254.169.254/about">About</a>`;
    expect(discoverCandidateLinks(html, BASE)).toEqual([]);
  });

  it("de-duplicates the same page linked more than once", () => {
    const html = `
      <a href="/about">About</a>
      <a href="/about/">About Us</a>
      <a href="/about#team">Meet the team</a>`;

    const candidates = discoverCandidateLinks(html, BASE);
    expect(candidates).toHaveLength(1);
  });

  it("keeps only one link per category even if several match", () => {
    const html = `<a href="/pricing">Pricing</a><a href="/plans">Plans</a>`;
    const candidates = discoverCandidateLinks(html, BASE);
    expect(candidates.filter((c) => c.key === "pricing")).toHaveLength(1);
  });

  it("caps the result at the maximum additional page count", () => {
    const html = `
      <a href="/about">About</a>
      <a href="/services">Services</a>
      <a href="/products">Products</a>
      <a href="/features">Features</a>
      <a href="/pricing">Pricing</a>
      <a href="/faq">FAQ</a>`;

    const candidates = discoverCandidateLinks(html, BASE);
    expect(candidates.length).toBeLessThanOrEqual(3);
    // Highest-priority categories (About, Services, Products) win the cap.
    expect(candidates.map((c) => c.key)).toEqual(["about", "services", "products"]);
  });

  it("ignores anchors, mailto, tel, and javascript hrefs", () => {
    const html = `
      <a href="#about">About (anchor only)</a>
      <a href="mailto:hello@acme.com">About mail</a>
      <a href="tel:+15551234567">About phone</a>
      <a href="javascript:void(0)">About js</a>`;

    expect(discoverCandidateLinks(html, BASE)).toEqual([]);
  });

  it("does not treat the homepage's own link as a candidate", () => {
    const html = `<a href="/">Home</a><a href="/about">About</a>`;
    const candidates = discoverCandidateLinks(html, BASE);
    expect(candidates.map((c) => c.key)).toEqual(["about"]);
  });

  it("returns no candidates for a page with no links (no recursion possible)", () => {
    expect(discoverCandidateLinks("<p>No links here.</p>", BASE)).toEqual([]);
  });

  it("returns no candidates when the base URL is invalid", () => {
    expect(discoverCandidateLinks(`<a href="/about">About</a>`, "not-a-url")).toEqual([]);
  });
});

/* =======================================================
   Website Analysis Integration
======================================================= */

describe("analyzeWebsite", () => {
  it("is exported as a function", async () => {
    const { analyzeWebsite } = await import("./website-analysis");
    expect(typeof analyzeWebsite).toBe("function");
  });
});

/* =======================================================
   No references to prospra_brand_profiles
======================================================= */

describe("dead code removal", () => {
  it("actions.ts does not reference prospra_brand_profiles", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const actionsContent = fs.readFileSync(
      path.resolve(__dirname, "./actions.ts"),
      "utf-8"
    );
    expect(actionsContent).not.toContain("prospra_brand_profiles");
  });

  it("persistence.ts does not reference prospra_brand_profiles", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "./persistence.ts"),
      "utf-8"
    );
    expect(content).not.toContain("prospra_brand_profiles");
  });

  it("actions.ts does not export importFromProspra", async () => {
    const actions = await import("./actions");
    expect("importFromProspra" in actions).toBe(false);
  });
});
