import type { Metadata } from "next";
import Image from "next/image";
import { StarHunter } from "@/components/star-hunter";
import { getDict } from "@/lib/locale";
import { PHOTOS } from "@/lib/photos";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getDict();
  return { title: dict.stars.title, description: dict.stars.lead };
}

export default async function StarsPage() {
  const { locale, dict } = await getDict();
  const p = PHOTOS["alula-sky"];
  return (
    <div className="on-dark bg-night text-star">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <div className="frame pb-24 pt-10 md:pt-16">
          <h1 className="display">{dict.stars.title}</h1>
          <p className="lead mt-6 max-w-[40ch]">{dict.stars.lead}</p>
          <p className="small mt-4 max-w-[52ch] text-star-2">{dict.stars.noLight}</p>
          <div className="mt-12">
            <StarHunter />
          </div>
        </div>
        <figure className="relative order-first h-[52svh] overflow-hidden lg:order-none lg:sticky lg:top-0 lg:h-svh lg:self-start">
          <Image src={p.src} alt={p.alt[locale]} fill priority sizes="(min-width: 1024px) 45vw, 100vw" className="drift object-cover" />
          <figcaption className="small absolute bottom-0 start-0 m-4 bg-night/85 px-3 py-1.5">{p.caption[locale]}</figcaption>
        </figure>
      </div>
    </div>
  );
}
