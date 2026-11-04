import { HomeExperience } from "@/components/home-experience";

/** The homepage answers one question; method, permits and FAQ live on /about. */
export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const mode = sp.mode === "stars" || sp.mode === "kashta" ? sp.mode : undefined;

  return (
    <>
      <HomeExperience initialMode={mode} />
    </>
  );
}
