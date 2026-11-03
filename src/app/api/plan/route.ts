import { apiError, fromException, privateJson, readJson } from "@/lib/http";
import { buildPlan } from "@/lib/planner";
import { planPrefsSchema } from "@/lib/schemas";
import { upcomingNights } from "@/lib/nights";

export async function POST(request: Request) {
  const parsed = planPrefsSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return apiError("invalid_input", "Invalid planning preferences", parsed.error.issues);
  }
  const prefs = parsed.data;
  if (prefs.date !== "flexible" && !upcomingNights().includes(prefs.date)) {
    return apiError("invalid_input", "The date must be one of the next seven nights");
  }
  try {
    return privateJson(await buildPlan(prefs));
  } catch (err) {
    return fromException(err);
  }
}
