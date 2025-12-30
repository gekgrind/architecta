"use client";

import React, { useEffect, useState } from "react";
import ReactFlow, { Background } from "reactflow";
import "reactflow/dist/style.css";

import { StudioMode, GraphState } from "./studioTypes";

interface StudioCanvasProps {
  mode: StudioMode;
  onSelectNode: (node: any | null) => void;
  onGraphChange: (graph: GraphState) => void;
  onBackToBlueprint?: () => void;
  onRefine?: (
    nodeId: string,
    platform: string,
    text: string,
    preset?: "clearer" | "shorter" | "bolder" | "cta_stronger"
  ) => void;
}

export default function StudioCanvas({
  mode,
  onSelectNode,
  onGraphChange,
  onBackToBlueprint,
  onRefine,
}: StudioCanvasProps) {
  const [graph, setGraph] = useState<GraphState>({ nodes: [], edges: [] });

  useEffect(() => {
    onGraphChange(graph);
  }, [graph, onGraphChange]);

  if (mode === "generate") {
    const contentNodes = graph.nodes.filter(
      (n) => (n.data as any)?.generatedContent
    );

    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-3">
          <div className="text-sm text-white/70">Generated Content</div>
          <button
            onClick={onBackToBlueprint}
            className="rounded bg-white/10 px-3 py-1 text-xs hover:bg-white/20"
          >
            ← Back to Blueprint
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {contentNodes.map((node) => {
            const generated = (node.data as any).generatedContent;

            return Object.entries(generated).map(
              ([platform, versions]: any) => (
                <div
                  key={`${node.id}-${platform}`}
                  className="rounded-lg border border-white/10 bg-white/5 p-6 space-y-4"
                >
                  <div className="text-xs uppercase tracking-wide text-emerald-400">
                    {platform.replaceAll("_", " ")}
                  </div>

                  <div className="flex gap-2 text-xs">
                    <button onClick={() => onRefine?.(node.id, platform, versions.at(-1).text, "clearer")}>Clearer</button>
                    <button onClick={() => onRefine?.(node.id, platform, versions.at(-1).text, "shorter")}>Shorter</button>
                    <button onClick={() => onRefine?.(node.id, platform, versions.at(-1).text, "bolder")}>Bolder</button>
                    <button onClick={() => onRefine?.(node.id, platform, versions.at(-1).text, "cta_stronger")}>CTA+</button>
                  </div>

                  {versions.map((v: any, i: number) => (
                    <pre
                      key={i}
                      className="whitespace-pre-wrap text-sm bg-black/30 p-3 rounded"
                    >
                      {v.text}
                    </pre>
                  ))}
                </div>
              )
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={graph.nodes}
      edges={graph.edges}
      onNodeClick={(_, node) => onSelectNode(node)}
      fitView
    >
      <Background gap={24} color="#1f2937" />
    </ReactFlow>
  );
}
