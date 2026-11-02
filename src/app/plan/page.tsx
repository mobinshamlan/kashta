import type { Metadata } from "next";
import { Planner } from "@/components/planner";
import { getDict } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getDict();
  return { title: dict.plan.title, description: dict.plan.lead };
}

export default async function PlanPage({ searchParams }: PageProps<"/plan">) {
  const { dict } = await getDict();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 600) : "";
  const exp = sp.exp === "stars" || sp.exp === "kashta" ? sp.exp : undefined;

  return (
    <div className="frame pb-10 pt-10 md:pt-16">
      <header className="mb-14 max-w-[52rem]">
        <h1 className="display">{dict.plan.title}</h1>
        <p className="lead mt-6 max-w-[44ch]">{dict.plan.lead}</p>
      </header>
      <Planner initialText={q} initialExperience={exp} />
    </div>
  );
}
