/** A thin Sadu-inspired band: stepped (woven) triangles in red, black, white and undyed wool. */
export function SaduBand({ className = "" }: { className?: string }) {
  return (
    <svg className={`sadu-band ${className}`} aria-hidden="true" focusable="false">
      <defs>
        <pattern id="sadu-unit" width="28" height="14" patternUnits="userSpaceOnUse">
          <rect width="28" height="14" fill="#1a1413" />
          <rect y="0" width="28" height="2" fill="#b08a5c" />
          <rect y="12" width="28" height="2" fill="#b08a5c" />
          {/* Stepped triangle, built from 2px rows like a weave. */}
          <path d="M2 10h12v-2h-2v-2h-2v-2h-4v2h-2v2h-2z" fill="#94482f" />
          <path d="M16 10h10v-2h-2v-2h-2v-2h-2v2h-2v2h-2z" fill="#94482f" opacity="0.85" />
          <rect x="7" y="6" width="2" height="2" fill="#e9e1d2" />
          <rect x="20" y="6" width="2" height="2" fill="#e9e1d2" />
        </pattern>
      </defs>
      <rect width="100%" height="14" fill="url(#sadu-unit)" />
    </svg>
  );
}
