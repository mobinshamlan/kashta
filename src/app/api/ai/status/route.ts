import { privateJson } from "@/lib/http";
import { llamaConfig } from "@/lib/llm";

export function GET() {
  const { configured, provider, model } = llamaConfig();
  return privateJson({ configured, provider, model: configured ? model : null });
}
