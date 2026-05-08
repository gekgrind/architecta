import type { Node, Edge } from "reactflow";
import type { GeneratedContent } from "@/lib/types";

export function blueprintToContent(
  nodes: Node[],
  edges: Edge[]
): GeneratedContent {
  void edges;

  if (!nodes.length) {
    return {
      headline: "",
      body: "",
      cta: "",
    };
  }

  // Sort nodes top-to-bottom
  const orderedNodes = [...nodes].sort(
    (a, b) => (a.position?.y ?? 0) - (b.position?.y ?? 0)
  );

  // Headline = first content node
  const headline =
    orderedNodes.find((n) => n.data?.type === "headline")?.data?.label ?? "";

  // Body = all content nodes except headline + CTA
  const body = orderedNodes
    .filter(
      (n) =>
        n.data?.type !== "headline" &&
        n.data?.type !== "cta" &&
        typeof n.data?.label === "string"
    )
    .map((n) => n.data.label)
    .join("\n\n");

  // CTA node (fallback-safe)
  const cta =
    orderedNodes.find((n) => n.data?.type === "cta")?.data?.label ??
    "Learn more";

  return {
    headline,
    body,
    cta,
  };
}
