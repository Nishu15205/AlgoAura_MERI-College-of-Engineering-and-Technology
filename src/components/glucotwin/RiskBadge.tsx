// Risk badge — colored pill showing Low / Medium / High.
import { cn } from "@/lib/utils";
import type { RiskBand } from "./types";
import { bandColor, bandDot } from "./api";

export function RiskBadge({
  band,
  probability,
  className,
}: {
  band: RiskBand;
  probability?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        bandColor(band),
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", bandDot(band))} />
      {band}
      {probability !== undefined && (
        <span className="font-normal opacity-70">
          {Math.round(probability * 100)}%
        </span>
      )}
    </span>
  );
}
