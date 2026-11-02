import { llamaConfig } from "@/lib/llm";

export function GET() {
  const { configured, provider, model } = llamaConfig();
  return Response.json({ configured, provider, model: configured ? model : null });
}
