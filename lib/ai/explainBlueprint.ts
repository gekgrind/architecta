import type {
  GraphNode,
  GraphEdge,
} from "@/components/studio/studioTypes";

/**
 * Explain the blueprint in plain English.
 * This function is intentionally conservative:
 * - It does NOT assume node shapes
 * - It works with unknown node data
 * - It produces a clean, structured explanation
 */
export function explainBlueprint(
  nodes: GraphNode[],
  edges: GraphEdge[]
): {
  summary: string;
  steps: string[];
} {
  // Basic counts
  const nodeCount = nodes.length;
  const edgeCount = edges.length;

  if (nodeCount === 0) {
    return {
      summary: "This blueprint is empty.",
      steps: ["Add your first node to begin building your flow."],
    };
  }

  // Build adjacency map
  const outgoing = new Map<string, string[]>();

  for (const edge of edges) {
    if (!outgoing.has(edge.source)) {
      outgoing.set(edge.source, []);
    }
    outgoing.get(edge.source)!.push(edge.target);
  }

  // Try to find starting nodes (nodes with no incoming edges)
  const incomingSet = new Set(edges.map((e) => e.target));
  const startNodes = nodes.filter((n) => !incomingSet.has(n.id));

  const orderedSteps: string[] = [];

  // Helper to describe a node safely
  function describeNode(node: GraphNode, index: number) {
    const data = node.data;

    if (data && typeof data === "object") {
      if (typeof (data as { idea?: unknown }).idea === "string") {
        return `Step ${index + 1}: ${(data as { idea: string }).idea}`;
      }

      if (typeof (data as { label?: unknown }).label === "string") {
        return `Step ${index + 1}: ${(data as { label: string }).label}`;
      }
    }

    return `Step ${index + 1}: Node ${node.id}`;
  }

  // Walk the graph from each start node
  const visited = new Set<string>();

  function walk(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    orderedSteps.push(describeNode(node, orderedSteps.length));

    const next = outgoing.get(nodeId) || [];
    for (const target of next) {
      walk(target);
    }
  }

  if (startNodes.length > 0) {
    for (const start of startNodes) {
      walk(start.id);
    }
  } else {
    // Fallback: walk all nodes if graph is cyclic
    nodes.forEach((n) => walk(n.id));
  }

  // Final summary
  const summaryParts = [
    `This blueprint contains ${nodeCount} node${nodeCount === 1 ? "" : "s"}`,
    edgeCount > 0
      ? `connected by ${edgeCount} relationship${edgeCount === 1 ? "" : "s"}.`
      : "with no connections yet.",
  ];

  return {
    summary: summaryParts.join(" "),
    steps:
      orderedSteps.length > 0
        ? orderedSteps
        : ["This blueprint defines structure but no clear sequence yet."],
  };
}
