/** BusMate mark: a route pin with a bus window, original artwork. */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect width="40" height="40" rx="12" fill="#F5B301" />
      <path d="M20 8c-5.5 0-9.5 4-9.5 9.3 0 6.4 7.6 13.6 8.6 14.5a1.3 1.3 0 0 0 1.8 0c1-.9 8.6-8.1 8.6-14.5C29.5 12 25.5 8 20 8Z" fill="#0C1322" />
      <rect x="14.5" y="12.5" width="11" height="7.5" rx="2" fill="#F5B301" />
      <rect x="16" y="14" width="3.6" height="3" rx="0.8" fill="#0C1322" />
      <rect x="20.4" y="14" width="3.6" height="3" rx="0.8" fill="#0C1322" />
      <circle cx="16.8" cy="21.8" r="1.3" fill="#F5B301" />
      <circle cx="23.2" cy="21.8" r="1.3" fill="#F5B301" />
    </svg>
  );
}
