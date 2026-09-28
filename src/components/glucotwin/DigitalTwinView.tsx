"use client";
// Digital Twin View — the main page. Shows the selected virtual patient's
// glucose chart with the 2-hour prediction, the risk gauge with SHAP "why"
// reasons, the EHR panel, the wearable signals, and the alert timeline.
// Includes a "Live replay" toggle that streams data over SSE.
import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { GlucoseChart } from "./GlucoseChart";
import { RiskGauge } from "./RiskGauge";
import { EhrPanel } from "./EhrPanel";
import { WearablePanel } from "./WearablePanel";
import { AlertTimeline } from "./AlertTimeline";
import { CgmMetricsPanel } from "./CgmMetricsPanel";
import { RiskBadge } from "./RiskBadge";
import { fetchPatient, fetchTimeseries, fetchRisk } from "./api";
import type { EhrPatient, WearablePoint, RiskPrediction } from "./types";
import {
  Radio,
  RefreshCw,
  Droplet,
  TrendingUp,
  Lightbulb,
  ChevronRight,
} from "lucide-react";

export function DigitalTwinView({
  patientId,
  onOpenWhatIf,
}: {
  patientId: string;
  onOpenWhatIf: () => void;
}) {
  const [patient, setPatient] = useState<EhrPatient | null>(null);
  const [history, setHistory] = useState<WearablePoint[]>([]);
  const [risk, setRisk] = useState<RiskPrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [livePoints, setLivePoints] = useState<WearablePoint[]>([]);
  const esRef = useRef<EventSource | null>(null);

  // Fetch patient + timeseries + risk. Used by the mount effect (below) and the
  // Refresh button. setState only happens inside async callbacks.
  function fetchData() {
    return Promise.all([
      fetchPatient(patientId),
      fetchTimeseries(patientId, 12),
      fetchRisk(patientId),
    ])
      .then(([p, ts, r]) => {
        setPatient(p.patient);
        setHistory(ts.samples);
        setRisk(r);
        setError(null);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }

  // Mount / patient change: initial load. loading starts true via useState; the
  // parent keys this view by patientId so it remounts (and the skeleton shows).
  useEffect(() => {
    fetchData();
  }, [patientId]);

  // Refresh button handler (event handler → setState allowed synchronously).
  function refresh() {
    setLoading(true);
    setLivePoints([]);
    fetchData();
  }

  // SSE live replay
  useEffect(() => {
    if (!live) {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      return;
    }
    const es = new EventSource(`/api/stream/${patientId}?speed=1500`);
    esRef.current = es;
    es.onopen = () => setLivePoints([]);
    es.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data);
        setLivePoints((prev) => [
          ...prev,
          {
            ts: d.ts,
            tsHuman: d.tsHuman,
            glucose: d.glucose,
            heartRate: d.heartRate,
            hrvRmssd: d.hrvRmssd,
            steps: d.steps,
            sleepStage: d.sleepStage,
            mealCarbsG: d.mealCarbsG,
            activityMin: d.activityMin,
          },
        ]);
      } catch {}
    };
    es.addEventListener("done", () => {
      setLive(false);
    });
    es.onerror = () => {
      setLive(false);
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [live, patientId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error || !patient || !risk) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-sm text-rose-600 mb-3">
            {error || "Unable to load patient data."}
          </div>
          <Button onClick={load} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* patient header */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
              {patient.name.charAt(0)}
            </div>
            <div>
              <div className="font-semibold text-lg flex items-center gap-2">
                {patient.name}
                <span className="text-sm text-muted-foreground font-normal">{patient.id}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {patient.age}y {patient.sex} · HbA1c {patient.hba1c}% · BMI {patient.bmi.toFixed(1)} ·{" "}
                {patient.medication}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={live ? "default" : "outline"}
              size="sm"
              onClick={() => setLive((v) => !v)}
            >
              <Radio className={`h-4 w-4 mr-2 ${live ? "animate-pulse" : ""}`} />
              {live ? "Live replay ON" : "Live replay"}
            </Button>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>
            <RiskBadge band={risk.band} probability={risk.probability} />
          </div>
        </CardContent>
      </Card>

      {/* main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* glucose chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Droplet className="h-4 w-4 text-primary" />
              Continuous Glucose + 2-hour Prediction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GlucoseChart
              history={history}
              prediction={risk.glucoseCurve}
              livePoints={livePoints}
              currentGlucose={risk.currentGlucose}
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-3 rounded-sm bg-[var(--chart-1)]" /> CGM history
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-3 rounded-sm bg-[var(--chart-3)] opacity-70" /> Prediction
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[var(--chart-2)]" /> Meals
              </span>
              <span className="flex items-center gap-1">
                <span className="h-0.5 w-4 bg-[var(--chart-3)]" /> 180 threshold
              </span>
            </div>
          </CardContent>
        </Card>

        {/* risk gauge + reasons */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Spike Risk (next 120 min)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RiskGauge probability={risk.probability} band={risk.band} />
            <div className="mt-3 pt-3 border-t">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <Lightbulb className="h-3 w-3" /> Why this risk (SHAP-style)
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {risk.reasons.map((r, i) => {
                  const maxAbs = Math.max(...risk.reasons.map((x) => Math.abs(x.contribution)), 0.01);
                  const w = Math.min(100, (Math.abs(r.contribution) / maxAbs) * 100);
                  const up = r.contribution > 0;
                  return (
                    <div key={i} className="text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{r.display}</span>
                        <span className={up ? "text-rose-500" : "text-emerald-500"}>
                          {up ? "+" : ""}
                          {r.contribution.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-1 bg-muted rounded-full mt-0.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${up ? "bg-rose-400" : "bg-emerald-400"}`}
                          style={{ width: `${w}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <Button onClick={onOpenWhatIf} variant="outline" size="sm" className="w-full mt-3">
              Run what-if simulation <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* secondary grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <EhrPanel patient={patient} />
        <WearablePanel samples={history} />
        <CgmMetricsPanel patientId={patientId} />
      </div>

      <AlertTimeline patientId={patientId} />

      {live && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-xs font-medium shadow-lg flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
          Streaming live CGM · {livePoints.length} points
        </div>
      )}
    </div>
  );
}
