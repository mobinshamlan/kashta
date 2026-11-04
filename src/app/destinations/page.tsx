import { redirect } from "next/navigation";

/** Places now live on the homepage (map and list for the chosen night); keep old links working. */
export default async function DestinationsPage({ searchParams }: PageProps<"/destinations">) {
  const sp = await searchParams;
  const mode = sp.mode === "stars" || sp.mode === "kashta" ? sp.mode : undefined;
  redirect(mode ? `/?mode=${mode}#places` : "/#places");
}
