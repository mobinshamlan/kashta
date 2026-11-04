import { ExternalLink } from "lucide-react";
import type { Dict } from "@/lib/i18n";
import type { Locale, Permit, PermitStatus } from "@/lib/types";

const STATUS_STYLE: Record<PermitStatus, { bg: string; fg: string }> = {
  verified_permitted: { bg: "var(--color-good)", fg: "#fff" },
  permit_required: { bg: "var(--color-clay)", fg: "#fff" },
  restricted: { bg: "var(--color-poor)", fg: "#fff" },
  unverified: { bg: "var(--color-ink-2)", fg: "#fff" },
};

export function PermitBadge({ status, label }: { status: PermitStatus; label: string }) {
  const s = STATUS_STYLE[status];
  return (
    <span className="small inline-flex items-center px-2.5 py-1 font-medium" style={{ background: s.bg, color: s.fg }}>
      {label}
    </span>
  );
}

/**
 * The permit's source facts. "block": the full olive panel with the apply action. "quiet": inside a
 * reference section, where the apply action already sits at the top of the page.
 */
export function PermitPanel({ permit, dict, locale, variant = "block" }: { permit: Permit; dict: Dict; locale: Locale; variant?: "block" | "quiet" }) {
  const quiet = variant === "quiet";
  const checked = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${permit.checkedOn}T12:00:00Z`));

  return (
    <section id="permit" aria-labelledby="permit-heading" className={quiet ? "" : "rounded-[14px] bg-olive p-6 text-olive-ink md:p-10"}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="permit-heading" className={quiet ? "font-medium" : "sub"}>
          {dict.permit.title}
        </h2>
        <PermitBadge status={permit.status} label={dict.permit.short[permit.status]} />
      </div>
      <p className={`${quiet ? "mt-3" : "mt-5"} max-w-[60ch]`}>{permit.notes[locale]}</p>
      <dl className="small mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-[auto_1fr]">
        <dt className="font-medium">{dict.common.source}</dt>
        <dd>
          <a className="link inline-flex items-center gap-1.5" href={permit.sourceUrl} target="_blank" rel="noopener">
            {permit.sourceTitle[locale]}
            <ExternalLink aria-hidden size={14} />
          </a>
        </dd>
        <dt className="font-medium">{dict.common.checkedOn}</dt>
        <dd className="num">{checked}</dd>
      </dl>
      {permit.applyUrl && !quiet && (
        <a
          href={permit.applyUrl}
          target="_blank"
          rel="noopener"
          className="mt-8 inline-flex min-h-12 items-center gap-2 bg-olive-ink px-5 font-medium text-olive transition-colors hover:bg-sand"
        >
          {dict.permit.apply}
          <ExternalLink aria-hidden size={16} />
        </a>
      )}
      <p className={`small mt-6 max-w-[62ch] ${quiet ? "text-ink-2" : "opacity-90"}`}>
        {dict.permit.disclaimer} {dict.permit.noLive}
      </p>
    </section>
  );
}
