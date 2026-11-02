"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Watches every [data-reveal] element and marks it shown when it scrolls into view.
 * Content is visible by default (no `js` class means no hiding), so nothing depends on this.
 */
export function RevealRoot() {
  const pathname = usePathname();
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.setAttribute("data-shown", "");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    const observe = () =>
      document.querySelectorAll("[data-reveal]:not([data-shown])").forEach((el) => io.observe(el));
    observe();
    const mo = new MutationObserver(observe);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [pathname]);
  return null;
}
