"use client";
// Wearable panel — heart rate, HRV, steps, and sleep-stage mini charts for the
// recent window.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";
import type { WearablePoint } from "./types";
import { Activity, Heart, Waves, Moon } from "lucide-react";

export function WearablePanel({ samples }: { samples: WearablePoint[] }) {
  const data = samples.map((s, i) => ({
    i,
    hr: s.heartRate,
    hrv: s.hrvRmssd,
    steps: s.steps,
    sleep: sleepScore(s.sleepStage),
    stage: s.sleepStage,
  }));

  const totalSteps = data.reduce((s, d) => s + d.steps, 0);
  const avgHr = Math.round(data.reduce((s, d) => s + d.hr, 0) / Math.max(1, data.length));
  const avgHrv = Math.round(data.reduce((s, d) => s + d.hrv, 0) / Math.max(1, data.length));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Wearable Signals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <MiniStat icon={Heart} label="Avg HR" value={`${avgHr}`} unit="bpm" tint="text-rose-500" />
          <MiniStat icon={Waves} label="Avg HRV" value={`${avgHrv}`} unit="ms" tint="text-violet-500" />
          <MiniStat icon={Activity} label="Steps" value={`${totalSteps}`} unit="" tint="text-emerald-500" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ChartBlock label="Heart rate (bpm)">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="hrFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis domain={[40, "dataMax + 10"]} hide />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--border)" }}
                  labelFormatter={() => ""}
                  formatter={(v: number) => [`${Math.round(v)} bpm`, "HR"]}
                />
                <Area type="monotone" dataKey="hr" stroke="var(--chart-3)" strokeWidth={1.5} fill="url(#hrFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartBlock>

          <ChartBlock label="HRV rmssd (ms)">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <YAxis hide />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--border)" }}
                  labelFormatter={() => ""}
                  formatter={(v: number) => [`${Math.round(v)} ms`, "HRV"]}
                />
                <Line type="monotone" dataKey="hrv" stroke="var(--chart-4)" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartBlock>

          <ChartBlock label="Steps (per 5 min)">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <YAxis hide />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--border)" }}
                  labelFormatter={() => ""}
                  formatter={(v: number) => [`${Math.round(v)}`, "Steps"]}
                />
                <Bar dataKey="steps" fill="var(--chart-5)" />
              </BarChart>
            </ResponsiveContainer>
          </ChartBlock>

          <ChartBlock label="Sleep stage">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="sleepFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis domain={[0, 3]} hide />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--border)" }}
                  labelFormatter={() => ""}
                  formatter={(_v: number, _n: string, p: any) => [p?.payload?.stage ?? "", "Stage"]}
                />
                <Area type="step" dataKey="sleep" stroke="var(--chart-1)" strokeWidth={1.5} fill="url(#sleepFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartBlock>
        </div>
      </CardContent>
    </Card>
  );
}

function sleepScore(stage: string): number {
  switch (stage) {
    case "awake": return 0;
    case "light": return 1;
    case "rem": return 2;
    case "deep": return 3;
    default: return 0;
  }
}

function MiniStat({
  icon: Icon,
  label,
  value,
  unit,
  tint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  unit: string;
  tint: string;
}) {
  return (
    <div className="bg-muted/40 rounded-md p-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className={`h-3 w-3 ${tint}`} />
        {label}
      </div>
      <div className="text-lg font-bold leading-tight mt-0.5">
        {value}
        {unit && <span className="text-xs text-muted-foreground font-normal ml-1">{unit}</span>}
      </div>
    </div>
  );
}

function ChartBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
        {label === "Sleep stage" && <Moon className="h-3 w-3" />}
        {label}
      </div>
      <div className="h-20">{children}</div>
    </div>
  );
}
