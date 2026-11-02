import type { Metadata, Viewport } from "next";
import { Aref_Ruqaa, IBM_Plex_Sans_Arabic } from "next/font/google";
import { LocaleProvider } from "@/components/locale-provider";
import { RevealRoot } from "@/components/reveal-root";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getDict } from "@/lib/locale";
import "./globals.css";

const plex = IBM_Plex_Sans_Arabic({
  variable: "--font-plex",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const ruqaa = Aref_Ruqaa({
  variable: "--font-ruqaa",
  subsets: ["arabic", "latin"],
  weight: "400",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getDict();
  return {
    title: { default: dict.meta.title, template: `%s · KASHTA كشتة` },
    description: dict.meta.description,
    icons: { icon: "/icon.svg" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e9e1d2",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale, dict } = await getDict();
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={`${plex.variable} ${ruqaa.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Marks the page as scripted so entrance animations can hide content until it scrolls in. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="min-h-dvh flex flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-50 focus:bg-ink focus:px-4 focus:py-3 focus:text-sand"
        >
          {dict.nav.skip}
        </a>
        <LocaleProvider locale={locale}>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          <RevealRoot />
        </LocaleProvider>
      </body>
    </html>
  );
}
