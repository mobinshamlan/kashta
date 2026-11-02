export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 48" fill="none" aria-hidden="true" className={className}>
      <circle cx="35" cy="12" r="6" fill="currentColor" />
      <path d="M3 32C15 32 19 18 30 21C40 24 43 33 53 33M3 41C18 41 23 30 34 32C42 33 45 40 53 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
