"use client";

import { useEffect } from "react";

/** Opens the <details> section a link points at (e.g. /about#privacy), so deep links still land on content. */
export function OpenOnHash() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const el = document.getElementById(id);
      const details = el instanceof HTMLDetailsElement ? el : el?.closest("details");
      if (details) {
        details.open = true;
        details.scrollIntoView({ block: "start" });
      }
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
