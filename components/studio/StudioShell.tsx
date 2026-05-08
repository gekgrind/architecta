"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import StudioSidebar from "./StudioSidebar";
import StudioCanvas from "./StudioCanvas";
import StudioInspector from "./StudioInspector";

import { BlueprintBackground } from "@/components/dashboard/BlueprintBackground";
import {
  StudioMode,
  SelectedNode,
  Suggestion,
  GraphState,
  ContentNodeData,
  isContentNodeData,
} from "./studioTypes";

import { explainBlueprint } from "@/lib/ai/explainBlueprint";

type RefinePreset = "clearer" | "shorter" | "bolder" | "cta_stronger";

export default function StudioShell() {
  const [mode, setMode] = useState<StudioMode>("blueprint");
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [graph, setGraph] = useState<GraphState>({ nodes: [], edges: [] });

  const [aiExplanation, setAiExplanation] = useState<{
    summary: string;
    steps: string[];
  } | null>(null);

  /* ------------------------------------------------------------
   * Auto-save (debounced)
   * ---------------------------------------------------------- */
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestGraphRef = useRef<GraphState>(graph);
  const isSavingRef = useRef(false);
  const queuedSaveRef = useRef(false);

  const [, setSaveStatus] = useState<
    "idle" | "dirty" | "saving" | "saved" | "error"
  >("idle");

  useEffect(() => {
    latestGraphRef.current = graph;
  }, [graph]);

  const postSave = useCallback(
    async (g: GraphState) => {
      try {
        isSavingRef.current = true;
        setSaveStatus("saving");

        const res = await fetch("/api/studio/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            graph: g,
            meta: {
              updatedAt: new Date().toISOString(),
              mode,
            },
          }),
        });

        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.ok) {
          throw new Error(json?.error?.message || `Save failed (${res.status})`);
        }

        setSaveStatus("saved");
      } catch (e) {
        console.error(e);
        setSaveStatus("error");
      } finally {
        isSavingRef.current = false;

        if (queuedSaveRef.current) {
          queuedSaveRef.current = false;
          void postSave(latestGraphRef.current);
        }
      }
    },
    [mode]
  );

  const scheduleSave = useCallback(() => {
    setSaveStatus("dirty");

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      const g = latestGraphRef.current;

      if (isSavingRef.current) {
        queuedSaveRef.current = true;
        return;
      }

      void postSave(g);
    }, 650);
  }, [postSave]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleGraphChange = useCallback(
    (next: GraphState) => {
      setGraph(next);
      latestGraphRef.current = next;
      scheduleSave();
    },
    [scheduleSave]
  );

  /* ------------------------------------------------------------
   * Suggestions
   * ---------------------------------------------------------- */
  function generateSuggestions(node: SelectedNode | null): Suggestion[] {
    if (!node) return [];
    return [
      { id: "add-step", label: "Add next step", action: "add-node" },
      { id: "branch", label: "Create branching decision", action: "add-node" },
    ];
  }

  function handleNodeSelect(node: SelectedNode | null) {
    setSelectedNode(node);
    setSuggestions(generateSuggestions(node));
  }

  function handleSuggestionApply(s: Suggestion) {
    if (!selectedNode) return;

    document.dispatchEvent(
      new CustomEvent("studio:add-node", {
        detail: { sourceNodeId: selectedNode.id, label: s.label },
      })
    );
  }

  /* ------------------------------------------------------------
   * Explain Blueprint
   * ---------------------------------------------------------- */
  function handleExplain() {
    setAiExplanation(explainBlueprint(graph.nodes, graph.edges));
  }

  /* ------------------------------------------------------------
   * Generate Content
   * ---------------------------------------------------------- */
  async function handleGenerateContent() {
    if (!selectedNode) return;

    const nodeData = selectedNode.data;
    if (!isContentNodeData(nodeData)) return;

    const brandKit = {
      brandName: "Architecta",
      audience: "Founders, solopreneurs, small teams",
      tone: "clear, confident, modern",
      topics: [],
      bannedPhrases: ["synergy", "game changer"],
      examples: [],
    };

    // Keep this tolerant: node data can be partially filled
    const gen: {
      platform: string;
      idea: string;
      goal: string;
      context?: string;
    } = {
      platform: nodeData.platform ?? "generic",
      idea: nodeData.idea ?? "",
      goal: nodeData.goal ?? "",
      context: nodeData.context,
    };

    const res = await fetch("/api/studio/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand: brandKit, gen }),
    });

    const json = await res.json();
    if (!json.ok) throw new Error(json.error?.message ?? "Generation failed");

    const generatedText = json.data.generation.text;

    const updatedNodes = graph.nodes.map((n) => {
      if (n.id !== selectedNode.id) return n;

      const existing = nodeData.generatedContent?.[nodeData.platform] ?? [];

      return {
        ...n,
        data: {
          ...nodeData,
          generatedContent: {
            ...(nodeData.generatedContent ?? {}),
            [nodeData.platform]: [
              ...existing,
              { text: generatedText, createdAt: json.data.generation.createdAt },
            ],
          },
        },
      };
    });

    const nextGraph = { ...graph, nodes: updatedNodes };
    setGraph(nextGraph);
    latestGraphRef.current = nextGraph;
    scheduleSave();
    setMode("generate");
  }

  /* ------------------------------------------------------------
   * Refine Content
   * ---------------------------------------------------------- */
  async function handleRefine(
    nodeId: string,
    platform: string,
    draft: string,
    preset?: RefinePreset
  ) {
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const nodeData = node.data as ContentNodeData;

    const revision =
      preset === "shorter"
        ? { tone: "same", length: "shorter", ctaStrength: "same" }
        : preset === "bolder"
        ? { tone: "bolder", length: "same", ctaStrength: "same" }
        : preset === "cta_stronger"
        ? { tone: "same", length: "same", ctaStrength: "stronger" }
        : { tone: "clearer", length: "same", ctaStrength: "subtle" };

    const res = await fetch("/api/studio/refine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand: { brandName: "Architecta" },
        platform,
        draft,
        revision,
      }),
    });

    const json = await res.json();
    if (!json.ok) throw new Error(json.error?.message ?? "Refine failed");

    const refinedText = json.data.refinement.text;

    const updatedNodes = graph.nodes.map((n) => {
      if (n.id !== nodeId) return n;

      const existing = nodeData.generatedContent?.[platform] ?? [];

      return {
        ...n,
        data: {
          ...nodeData,
          generatedContent: {
            ...nodeData.generatedContent,
            [platform]: [
              ...existing,
              { text: refinedText, createdAt: json.data.refinement.createdAt },
            ],
          },
        },
      };
    });

    const nextGraph = { ...graph, nodes: updatedNodes };
    setGraph(nextGraph);
    latestGraphRef.current = nextGraph;
    scheduleSave();
  }

  function handleBackToBlueprint() {
    setMode("blueprint");
  }

  /* ------------------------------------------------------------
   * Render
   * ---------------------------------------------------------- */
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#041C3B] text-white">
      <BlueprintBackground />
      <div className="relative z-10 flex h-screen w-full bg-[rgba(11,18,32,0.88)] backdrop-blur-sm">
        <aside className="w-[260px] border-r border-white/10">
          <StudioSidebar mode={mode} onModeChange={setMode} />
        </aside>

        <main className="flex-1 overflow-hidden">
          <StudioCanvas
            mode={mode}
            onSelectNode={handleNodeSelect}
            onGraphChange={handleGraphChange}
            onBackToBlueprint={handleBackToBlueprint}
            onRefine={handleRefine}
          />
        </main>

        <aside className="w-[300px] border-l border-white/10">
          <StudioInspector
            mode={mode}
            selectedNode={selectedNode}
            suggestions={suggestions}
            onApplySuggestion={handleSuggestionApply}
            aiExplanation={aiExplanation}
            onExplain={handleExplain}
            onGenerate={handleGenerateContent}
          />
        </aside>
      </div>
    </div>
  );
}
