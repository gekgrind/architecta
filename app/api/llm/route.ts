import { apiOk } from "@/lib/api/response";

// The generic /api/llm/generate endpoint was removed: it let any signed-in
// client choose task, tier, provider and token limits on paid models. AI is
// only reachable through feature routes that decide those server-side.
export function GET() {
  return apiOk({
    endpoints: [],
  });
}
