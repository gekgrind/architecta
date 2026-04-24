import { apiOk } from "@/lib/api/response";

export function GET() {
  return apiOk({
    endpoints: ["/api/llm/generate"],
  });
}
