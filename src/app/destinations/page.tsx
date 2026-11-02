import type { Metadata } from "next";
import { DestinationIndex } from "@/components/destination-index";
import { getDict } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getDict();
  return { title: dict.destinations.title, description: dict.destinations.lead };
}

export default async function DestinationsPage() {
  const { dict } = await getDict();
  return (
    <div className="frame pb-10 pt-10 md:pt-16">
      <header className="mb-12 max-w-[52rem]">
        <h1 className="display">{dict.destinations.title}</h1>
        <p className="lead mt-6 max-w-[46ch]">{dict.destinations.lead}</p>
      </header>
      <DestinationIndex />
    </div>
  );
}
