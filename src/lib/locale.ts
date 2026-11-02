import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, DICTS, isLocale, LOCALE_COOKIE } from "./i18n";
import type { Locale } from "./types";

export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getDict() {
  const locale = await getLocale();
  return { locale, dict: DICTS[locale] };
}
