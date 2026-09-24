"use client";
// Circular risk gauge — shows the model's spike probability as a colored arc.
import type { RiskBand } from "./types";

export function RiskGauge({
  probability,
  band,
}: {
  probability: number;
  band: RiskBand;
}) {
  const pct = Math.round(probability * 100);
  const r = 70;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75; // 270-degree gauge
  const offset = arc * (1 - probability);

  const color =
    band === "Low" ? "var(--chart-5)" : band === "Medium" ? "var(--chart-2)" : "var(--chart-3)";

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-[135deg]">
          {/* track */}
          <circle
            cx="90"
            cy="90"
            r={r}
            fill="none"
            stroke="var(--muted)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${arc} ${circ}`}
          />
          {/* value arc */}
          <circle
            cx="90"
            cy="90"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${arc - offset} ${circ}`}
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-4xl font-bold" style={{ color }}>
            {pct}
            <span className="text-lg">%</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">spike risk</div>
          <div
            className="mt-1 text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
          >
            {band}
          </div>
        </div>
      </div>
    </div>
  );
}
