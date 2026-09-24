"use client";
// The main glucose chart: recent CGM history (left of "now") joined to the
// 2-hour model prediction with a shaded confidence band, plus the 180 mg/dL
// spike-threshold line and meal markers.
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
  Legend,
} from "recharts";
import type { WearablePoint, GlucoseCurvePoint } from "./types";

interface Props {
  history: WearablePoint[];
  prediction: GlucoseCurvePoint[];
  livePoints?: WearablePoint[];
  height?: number;
  currentGlucose?: number;
}

export function GlucoseChart({
  history,
  prediction,
  livePoints = [],
  height = 320,
  currentGlucose,
}: Props) {
  // Build a unified dataset keyed by "minutes from now".
  const now = history.length ? history[history.length - 1].ts : Date.now() / 1000;

  const data: {
    x: number;
    label: string;
    history?: number;
    pred?: number;
    lower?: number;
    upper?: number;
    meal?: number;
  }[] = [];

  // history (negative x)
  for (const s of history) {
    const x = Math.round((s.ts - now) / 60);
    data.push({
      x,
      label: fmtMin(x),
      history: s.glucose,
      meal: s.mealCarbsG > 0 ? s.glucose : undefined,
    });
  }
  // live replay points (positive x, beyond now)
  for (const s of livePoints) {
    const x = Math.round((s.ts - now) / 60);
    if (x > 0) {
      data.push({ x, label: fmtMin(x), history: s.glucose });
    }
  }
  // prediction (0..120)
  for (const p of prediction) {
    data.push({
      x: p.t,
      label: fmtMin(p.t),
      pred: p.glucose,
      lower: p.lower,
      upper: p.upper,
    });
  }
  data.sort((a, b) => a.x - b.x);

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="x"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v) => fmtMin(v)}
            stroke="var(--muted-foreground)"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[60, "dataMax + 20"]}
            stroke="var(--muted-foreground)"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(v) => `${fmtMin(Number(v))} from now`}
            formatter={(value: number, name: string) => {
              if (name === "Confidence band") return [null, name];
              return [`${Math.round(value)} mg/dL`, name];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            iconType="line"
          />
          {/* confidence band */}
          <Area
            type="monotone"
            dataKey="upper"
            stroke="none"
            fill="url(#bandFill)"
            fillOpacity={1}
            name="Confidence band"
            legendType="none"
            connectNulls
          />
          <Area
            type="monotone"
            dataKey="lower"
            stroke="none"
            fill="var(--background)"
            fillOpacity={1}
            legendType="none"
            connectNulls
          />
          {/* threshold */}
          <ReferenceLine
            y={180}
            stroke="var(--chart-3)"
            strokeDasharray="6 4"
            strokeWidth={1.5}
            label={{
              value: "180 mg/dL",
              position: "insideTopRight",
              fill: "var(--chart-3)",
              fontSize: 10,
            }}
          />
          {/* now */}
          <ReferenceLine x={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
          {/* history line */}
          <Line
            type="monotone"
            dataKey="history"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={false}
            name="CGM history"
            connectNulls
          />
          {/* meal markers */}
          <Line
            type="monotone"
            dataKey="meal"
            stroke="none"
            dot={{ r: 4, fill: "var(--chart-2)", strokeWidth: 0 }}
            name="Meals"
            connectNulls
          />
          {/* prediction line */}
          <Line
            type="monotone"
            dataKey="pred"
            stroke="var(--chart-3)"
            strokeWidth={2.5}
            strokeDasharray="5 3"
            dot={false}
            name="Prediction"
            connectNulls
          />
          {currentGlucose !== undefined && (
            <ReferenceDot x={0} y={currentGlucose} r={5} fill="var(--chart-1)" stroke="var(--background)" strokeWidth={2} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function fmtMin(m: number): string {
  if (m === 0) return "now";
  if (m > 0) return `+${m}m`;
  return `${m}m`;
}
