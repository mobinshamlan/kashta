import type { Metadata } from "next";
import { Planner } from "@/components/planner";
import { getDict } from "@/lib/locale";
import { parsePlanShareParams } from "@/lib/share-link";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getDict();
  return { title: dict.plan.title, description: dict.plan.lead };
}

export default async function PlanPage({ searchParams }: PageProps<"/plan">) {
  const { locale, dict } = await getDict();
  const sp = await searchParams;
  const share = parsePlanShareParams(sp);
  const q = share.kind === "valid" ? "" : typeof sp.q === "string" ? sp.q.slice(0, 600) : "";
  const exp = share.kind === "valid"
    ? share.value.prefs.experience
    : sp.exp === "stars" || sp.exp === "kashta" ? sp.exp : undefined;

  return (
    <div className="frame pb-10 pt-7 md:pt-9">
      <header className="plan-masthead mb-7 pb-6">
        <h1 className="head">{dict.plan.title}</h1>
        <p className="mt-3 max-w-[60ch] text-ink-2">{dict.plan.lead}</p>
        <div className="journey-steps small !mt-5 text-ink-2">
          <span><b>1</b>{locale === "ar" ? "تفاصيل طلعتك" : "Your trip preferences"}</span>
          <span><b>2</b>{dict.plan.resultsTitle}</span>
        </div>
      </header>
      {share.kind === "invalid" && <p role="alert" className="mb-6 border-s-2 border-clay bg-sand-2 p-4">{dict.plan.invalidShare}</p>}
      <Planner initialText={q} initialExperience={exp} initialShare={share.kind === "valid" ? share.value : undefined} />
    </div>
  );
}
