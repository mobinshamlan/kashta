import type { Metadata } from "next";
import { DestinationIndex } from "@/components/destination-index";
import { getDict } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getDict();
  return { title: dict.destinations.title, description: dict.destinations.lead };
}

export default async function DestinationsPage({ searchParams }: PageProps<"/destinations">) {
  const { dict } = await getDict();
  const sp = await searchParams;
  const mode = sp.mode === "stars" || sp.mode === "kashta" ? sp.mode : undefined;
  return (
    <div className="frame pb-12 pt-8 md:pt-12">
      <header className="mb-8 max-w-[52rem]">
        <h1 className="head">{dict.destinations.title}</h1>
        <p className="mt-2 text-ink-2">{dict.home.scopeNote}</p>
      </header>
      <DestinationIndex initialMode={mode} />
    </div>
  );
}
