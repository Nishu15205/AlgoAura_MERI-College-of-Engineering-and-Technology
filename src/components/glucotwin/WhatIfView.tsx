"use client";
// What-if Simulator — sliders for meal carbs, walk minutes, sleep hours, and a
// medication toggle. Runs the twin simulator and shows baseline vs simulated
// glucose curves and the change in spike risk.
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from "recharts";
import { postWhatIf, fetchPatient } from "./api";
import type { WhatIfResult, EhrPatient } from "./types";
import { RiskBadge } from "./RiskBadge";
import { FlaskConical, Utensils, Footprints, Moon, Pill, Play, ArrowRight } from "lucide-react";

export function WhatIfView({ patientId }: { patientId: string }) {
  const [patient, setPatient] = useState<EhrPatient | null>(null);
  const [carbs, setCarbs] = useState(60);
  const [walk, setWalk] = useState(20);
  const [sleep, setSleep] = useState(6.5);
  const [skipMed, setSkipMed] = useState(false);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the patient profile and run an initial simulation with default sliders.
  // (loading starts true via useState; the parent keys this view by patientId so
  //  switching patients remounts it and the skeleton shows again.)
  useEffect(() => {
    let active = true;
    fetchPatient(patientId)
      .then((d) => {
        if (!active) return;
        setPatient(d.patient);
        setLoading(false);
        return postWhatIf(patientId, {
          carbs_g: 60,
          walk_minutes: 20,
          sleep_hours: 6.5,
          skip_medication: false,
        });
      })
      .then((r) => {
        if (active && r) setResult(r);
      })
      .catch((e) => {
        if (!active) return;
        setError(e.message);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [patientId]);

  function run() {
    setRunning(true);
    setError(null);
    postWhatIf(patientId, {
      carbs_g: carbs,
      walk_minutes: walk,
      sleep_hours: sleep,
      skip_medication: skipMed,
    })
      .then((r) => {
        setResult(r);
        setRunning(false);
      })
      .catch((e) => {
        setError(e.message);
        setRunning(false);
      });
  }

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (error || !patient) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-rose-600">
          {error || "Select a patient first."}
        </CardContent>
      </Card>
    );
  }

  const chartData =
    result?.baseline.map((b, i) => ({
      t: b.t,
      baseline: b.glucose,
      whatIf: result.whatIf[i]?.glucose,
    })) ?? [];

  const deltaPct = result ? Math.round(result.deltaRisk * 100) : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {patient.name.charAt(0)}
            </div>
            <div>
              <div className="font-semibold">{patient.name}</div>
              <div className="text-xs text-muted-foreground">
                {patient.id} · HbA1c {patient.hba1c}% · current glucose{" "}
                {Math.round(patient.latestGlucose)} mg/dL · {patient.medication}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-primary" />
              What-if scenario
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-sm">
                  <Utensils className="h-4 w-4 text-amber-500" /> Meal carbs
                </Label>
                <span className="text-sm font-semibold">{carbs} g</span>
              </div>
              <Slider value={[carbs]} onValueChange={(v) => setCarbs(v[0])} min={0} max={150} step={5} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-sm">
                  <Footprints className="h-4 w-4 text-emerald-500" /> Walk
                </Label>
                <span className="text-sm font-semibold">{walk} min</span>
              </div>
              <Slider value={[walk]} onValueChange={(v) => setWalk(v[0])} min={0} max={90} step={5} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-sm">
                  <Moon className="h-4 w-4 text-violet-500" /> Last night sleep
                </Label>
                <span className="text-sm font-semibold">{sleep.toFixed(1)} h</span>
              </div>
              <Slider value={[Math.round(sleep * 2)]} onValueChange={(v) => setSleep(v[0] / 2)} min={6} max={18} step={1} />
            </div>

            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm">
                <Pill className="h-4 w-4 text-rose-500" /> Skip medication
              </Label>
              <Switch checked={skipMed} onCheckedChange={setSkipMed} />
            </div>

            <Button onClick={run} disabled={running} className="w-full">
              <Play className="h-4 w-4 mr-2" />
              {running ? "Simulating..." : "Run simulation"}
            </Button>
            {error && <div className="text-xs text-rose-600">{error}</div>}
          </CardContent>
        </Card>

        {/* chart + result */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Simulated glucose — next 3 hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="t"
                    stroke="var(--muted-foreground)"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => (v === 0 ? "now" : `+${v}m`)}
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
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(v) => `+${v} min`}
                    formatter={(v: number, n: string) => [`${Math.round(v)} mg/dL`, n === "baseline" ? "Baseline" : "What-if"]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={180} stroke="var(--chart-3)" strokeDasharray="6 4" label={{ value: "180", fill: "var(--chart-3)", fontSize: 10, position: "insideTopRight" }} />
                  <Line type="monotone" dataKey="baseline" stroke="var(--muted-foreground)" strokeWidth={2} dot={false} name="baseline" />
                  <Line type="monotone" dataKey="whatIf" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} name="whatIf" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {result && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <Metric label="Baseline peak" value={`${Math.round(result.baselinePeak)}`} unit="mg/dL" />
                <Metric label="What-if peak" value={`${Math.round(result.whatIfPeak)}`} unit="mg/dL" highlight />
                <Metric
                  label="Risk change"
                  value={`${deltaPct >= 0 ? "+" : ""}${deltaPct}`}
                  unit="pts"
                  tone={deltaPct > 0 ? "bad" : deltaPct < 0 ? "good" : "neutral"}
                />
                <div className="bg-muted/40 rounded-md p-2.5">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Risk band</div>
                  <div className="flex items-center gap-1 mt-1">
                    <RiskBadge band={result.baselineRiskBand} />
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <RiskBadge band={result.whatIfRiskBand} />
                  </div>
                </div>
              </div>
            )}

            {result && (
              <div className="mt-3 p-3 rounded-md bg-primary/5 border border-primary/20 text-sm">
                {result.summary}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
  highlight,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
  tone?: "good" | "bad" | "neutral";
}) {
  const color = tone === "bad" ? "text-rose-600" : tone === "good" ? "text-emerald-600" : highlight ? "text-primary" : "";
  return (
    <div className="bg-muted/40 rounded-md p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${color}`}>
        {value}
        {unit && <span className="text-xs text-muted-foreground font-normal ml-1">{unit}</span>}
      </div>
    </div>
  );
}
