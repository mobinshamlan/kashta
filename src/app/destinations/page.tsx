import type { Metadata } from "next";
import { DestinationIndex } from "@/components/destination-index";
import { getDict } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getDict();
  return { title: dict.destinations.title, description: dict.destinations.lead };
}

export default async function DestinationsPage({ searchParams }: PageProps<"/destinations">) {
  const sp = await searchParams;
  const mode = sp.mode === "stars" || sp.mode === "kashta" ? sp.mode : undefined;
  // The page heading lives inside DestinationIndex, on the night scene that follows the mode.
  return <DestinationIndex initialMode={mode} />;
}
