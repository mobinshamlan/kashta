import type { Metadata } from "next";
import { Planner } from "@/components/planner";
import { getDict } from "@/lib/locale";
import { RECOMMENDABLE } from "@/lib/destinations";
import { parsePlanShareParams } from "@/lib/share-link";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getDict();
  return { title: dict.plan.title, description: dict.plan.lead };
}

export default async function PlanPage({ searchParams }: PageProps<"/plan">) {
  const { dict } = await getDict();
  const sp = await searchParams;
  const share = parsePlanShareParams(sp);
  const q = share.kind === "valid" ? "" : typeof sp.q === "string" ? sp.q.slice(0, 600) : "";
  const exp = share.kind === "valid"
    ? share.value.prefs.experience
    : sp.exp === "stars" || sp.exp === "kashta" ? sp.exp : undefined;
  // A night and place handed over from the homepage; only real, recommendable places count.
  const night = typeof sp.night === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.night) ? sp.night : undefined;
  const place = typeof sp.place === "string" && RECOMMENDABLE.some((d) => d.slug === sp.place) ? sp.place : undefined;

  return (
    <div className="frame pb-10 pt-7 md:pt-9">
      <header className="mb-6">
        <h1 className="sub font-medium">{dict.plan.title}</h1>
        <p className="mt-2 max-w-[60ch] text-ink-2">{dict.home.planSteps}</p>
      </header>
      {share.kind === "invalid" && <p role="alert" className="mb-6 border-s-2 border-clay bg-sand-2 p-4">{dict.plan.invalidShare}</p>}
      <Planner initialText={q} initialExperience={exp} initialShare={share.kind === "valid" ? share.value : undefined} initialNight={night && place ? night : undefined} initialPlace={night && place ? place : undefined} />
    </div>
  );
}
