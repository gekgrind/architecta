"use client";

import React, { useCallback, useEffect, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const supabase = createSupabaseBrowserClient();

// Custom node types
import AINode from "./nodes/AINode";
import DecisionNode from "./nodes/DecisionNode";
import OutputNode from "./nodes/OutputNode";

interface BlueprintCanvasProps {
  onSelectNode: (node: {
    id: string;
    label?: string;
    position: { x: number; y: number };
  } | null) => void;
  onGraphChange: (nodes: Node[], edges: Edge[]) => void;
}

const nodeTypes = {
  ai: AINode,
  decision: DecisionNode,
  output: OutputNode,
};

export default function BlueprintCanvas({
  onSelectNode,
  onGraphChange,
}: BlueprintCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const lastGraphRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);

  /* -------- LOAD -------- */

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;

      const res = await supabase
        .from("blueprints")
        .select("nodes, edges")
        .eq("user_id", data.user.id)
        .single();

      if (res.data?.nodes?.length) {
        setNodes(res.data.nodes);
        setEdges(res.data.edges ?? []);
      } else {
        setNodes([
          {
            id: "ai-1",
            type: "ai",
            position: { x: 250, y: 150 },
            data: { label: "Generate headline ideas" },
          },
        ]);
        setEdges([]);
      }
    }

    load();
  }, [setNodes, setEdges]);

  /* -------- SAVE (debounced) -------- */

  useEffect(() => {
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;

      await supabase.from("blueprints").upsert({
        user_id: data.user.id,
        nodes,
        edges,
        updated_at: new Date().toISOString(),
      });
    }, 600);

    return () => clearTimeout(t);
  }, [nodes, edges]);

  /* -------- AI SUGGESTION → ADD NODE -------- */

  const addNode = useCallback(
    (sourceId: string, label: string) => {
      const source = nodes.find((n) => n.id === sourceId);
      if (!source) return;

      const newNode: Node = {
        id: crypto.randomUUID(),
        type: "ai",
        position: {
          x: source.position.x + 220,
          y: source.position.y,
        },
        data: { label },
      };

      setNodes((n) => [...n, newNode]);
      setEdges((e) => [
        ...e,
        {
          id: crypto.randomUUID(),
          source: sourceId,
          target: newNode.id,
        },
      ]);
    },
    [nodes]
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ sourceNodeId: string; label: string }>;
      addNode(ev.detail.sourceNodeId, ev.detail.label);
    };

    document.addEventListener("studio:add-node", handler);
    return () => document.removeEventListener("studio:add-node", handler);
  }, [addNode]);

  /* -------- GRAPH UPDATES (GUARDED) -------- */

  useEffect(() => {
    const last = lastGraphRef.current;

    if (last && last.nodes === nodes && last.edges === edges) {
      return;
    }

    lastGraphRef.current = { nodes, edges };
    onGraphChange(nodes, edges);
  }, [nodes, edges, onGraphChange]);

  return (
    <div className="h-full w-full bg-[#0b1220]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) =>
          onSelectNode({
            id: node.id,
            label: node.data?.label as string | undefined,
            position: node.position,
          })
        }
        onPaneClick={() => onSelectNode(null)}
        fitView
      >
        <Background gap={24} size={1} color="#1f2937" />
        <MiniMap />
        <Controls />
      </ReactFlow>
    </div>
  );
}
