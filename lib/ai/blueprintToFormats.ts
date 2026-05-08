import type { Node, Edge } from "reactflow";

export interface MultiFormatContent {
  blog: {
    title: string;
    outline: string[];
  };
  email: {
    subject: string;
    body: string;
  };
  twitter: {
    thread: string[];
  };
  linkedin: {
    post: string;
  };
}

export function blueprintToFormats(
  nodes: Node[],
  edges: Edge[]
): MultiFormatContent {
  void edges;

  const steps = nodes.map((n) => n.data?.label ?? "Step");

  return {
    blog: {
      title: `How to ${steps[0]}`,
      outline: steps.map((s, i) => `Section ${i + 1}: ${s}`),
    },

    email: {
      subject: `How to ${steps[0]} (step-by-step)`,
      body: steps
        .map((s, i) => `${i + 1}. ${s}`)
        .join("\n\n"),
    },

    twitter: {
      thread: [
        `🧠 How to ${steps[0]} ↓`,
        ...steps.map((s, i) => `${i + 1}/${steps.length} ${s}`),
        `✨ Built with Architecta`,
      ],
    },

    linkedin: {
      post: `Here’s how to ${steps[0]}:\n\n${steps
        .map((s) => `• ${s}`)
        .join("\n")}\n\nBuilt with Architecta.`,
    },
  };
}
