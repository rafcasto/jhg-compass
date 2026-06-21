import type { LucideProps } from "lucide-react";

// Iceberg icon — the "Performance" tab metaphor: a small visible tip above the
// waterline and the large mass hidden below (req 4.2). Matches the lucide stroke API.
export function Iceberg({ size = 24, className, strokeWidth = 2, ...props }: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth as number}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* tip above the water */}
      <path d="M9 10 12 4l3 6" />
      {/* waterline */}
      <path d="M2 12h20" strokeDasharray="2 2" />
      {/* submerged mass */}
      <path d="M6 12l-2 5 4 3h8l4-3-2-5" />
    </svg>
  );
}
