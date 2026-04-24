// lib/ai/getMemoryForGeneration.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type MemoryMode = "generate" | "refine" | "learn";

interface GetMemoryArgs {
  userId: string;
  workspaceId?: string | null;
  mode: MemoryMode;
  platform?: string;
  idea?: string;
}

interface MemoryEvent {
  summary?: string | null;
  text?: string | null;
  [key: string]: unknown;
}

interface MemoryResult {
  summary: string;
  items: MemoryEvent[];
}

async function getSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
}

/**
 * Collects memory signals to guide generation/refinement
 */
export async function getMemoryForGeneration(
  args: GetMemoryArgs
): Promise<MemoryResult> {
  const { userId, workspaceId = null, mode, platform, idea } = args;

  const supabase = await getSupabaseServer();

  // Prevent unused-var lint drama for future expansion hooks
  void mode;
  void platform;
  void idea;

  // Fetch recent memory events
  const { data: events } = await supabase
    .from("memory_events")
    .select("*")
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(20);

  const memoryEvents: MemoryEvent[] = (events ?? []) as MemoryEvent[];

  if (memoryEvents.length === 0) {
    return {
      summary: "No relevant memory signals yet.",
      items: [],
    };
  }

  // Simple summarization logic (human-readable)
  const summaries = memoryEvents
    .map((event) => {
      if (event.summary) return `- ${event.summary}`;
      if (event.text) return `- ${event.text}`;
      return null;
    })
    .filter((value): value is string => value !== null);

  return {
    summary:
      summaries.length > 0
        ? summaries.join("\n")
        : "No relevant memory signals yet.",
    items: memoryEvents,
  };
}