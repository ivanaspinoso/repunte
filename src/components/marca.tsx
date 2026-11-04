/** Wordmark provisorio: una onda de línea fina + nombre. Reemplazar por el logo real. */
export function Marca({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-extrabold tracking-tight ${className}`}>
      <svg
        aria-hidden="true"
        viewBox="0 0 28 16"
        className="h-4 w-7 text-acento"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      >
        <path d="M1 12c3 0 3-4 6.5-4S11 12 14 12s3.5-8 7-8 3.5 4 6 4" />
      </svg>
      Repunte
    </span>
  );
}
