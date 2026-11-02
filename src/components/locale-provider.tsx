"use client";

import { createContext, useContext } from "react";
import { DICTS, type Dict } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

const LocaleContext = createContext<{ locale: Locale; dict: Dict }>({ locale: "ar", dict: DICTS.ar });

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={{ locale, dict: DICTS[locale] }}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  return useContext(LocaleContext);
}
