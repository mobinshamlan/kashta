import type { Metadata } from "next";
import Link from "next/link";
import { getDict } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getDict();
  return { title: locale === "ar" ? "الصفحة غير موجودة" : "Page not found" };
}

export default async function NotFound() {
  const { locale } = await getDict();
  const ar = locale === "ar";
  return (
    <div className="frame flex min-h-[70svh] flex-col justify-center py-20">
      <h1 className="display max-w-[14ch]">{ar ? "ضيّعنا الطريق" : "We lost the trail"}</h1>
      <p className="lead mt-6 max-w-[40ch]">
        {ar ? "الصفحة اللي تدورها مو موجودة." : "The page you're looking for isn't here."}
      </p>
      <div className="mt-10 flex flex-wrap gap-6">
        <Link href="/" className="btn">
          {ar ? "خطّط طلعتك" : "Plan your outing"}
        </Link>
      </div>
    </div>
  );
}
