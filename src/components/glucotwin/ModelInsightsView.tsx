"use client";
// Model Insights — metrics table (logreg vs GBDT), confusion matrix, ROC & PR
// curves, feature importance, regression MAE, and a plain-language explanation.
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Line,
  LineChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { fetchMetrics } from "./api";
import type { ModelMetricsData } from "./types";
import { Brain, LineChart as LineIcon, BarChart3, Grid3x3, BookOpen } from "lucide-react";

export function ModelInsightsView() {
  const [m, setM] = useState<ModelMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMetrics()
      .then((d) => {
        setM(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <Skeleton className="h-96 w-full" />;
  if (error || !m)
    return (
      <Card>
        <CardContent className="p-6 text-sm text-rose-600">
          {error || "Run `bun run build:all` to generate metrics."}
        </CardContent>
      </Card>
    );

  const rows: { key: string; label: string; logreg: number; gbdt: number; fmt: (n: number) => string }[] = [
    { key: "rocAuc", label: "ROC-AUC", logreg: m.logreg.rocAuc, gbdt: m.gbdt.rocAuc, fmt: (n) => n.toFixed(3) },
    { key: "prAuc", label: "PR-AUC", logreg: m.logreg.prAuc, gbdt: m.gbdt.prAuc, fmt: (n) => n.toFixed(3) },
    { key: "precision", label: "Precision", logreg: m.logreg.precision, gbdt: m.gbdt.precision, fmt: (n) => (n * 100).toFixed(1) + "%" },
    { key: "recall", label: "Recall", logreg: m.logreg.recall, gbdt: m.gbdt.recall, fmt: (n) => (n * 100).toFixed(1) + "%" },
    { key: "f1", label: "F1", logreg: m.logreg.f1, gbdt: m.gbdt.f1, fmt: (n) => n.toFixed(3) },
    { key: "accuracy", label: "Accuracy", logreg: m.logreg.accuracy, gbdt: m.gbdt.accuracy, fmt: (n) => (n * 100).toFixed(1) + "%" },
    { key: "brier", label: "Brier score", logreg: m.logreg.brierScore, gbdt: m.gbdt.brierScore, fmt: (n) => n.toFixed(3) },
  ];

  const cm = m.confusionMatrix;
  const cmTotal = cm.tp + cm.fp + cm.fn + cm.tn;
  const topFeatures = m.featureImportance.slice(0, 15);

  return (
    <div className="space-y-4">
      {/* header stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Patients" value={String(m.nPatients)} />
        <StatTile label="Training samples" value={m.nSamples.toLocaleString()} />
        <StatTile label="Decision threshold" value={m.threshold.toFixed(2)} />
        <StatTile label="Avg alert lead time" value={`${m.leadTimeMin.toFixed(0)} min`} accent />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* metrics table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" /> Model comparison (test set)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground text-left border-b">
                  <th className="py-2 font-medium">Metric</th>
                  <th className="py-2 font-medium text-right">Log. Reg.</th>
                  <th className="py-2 font-medium text-right">GBDT</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b last:border-0">
                    <td className="py-2">{r.label}</td>
                    <td className="py-2 text-right text-muted-foreground">{r.fmt(r.logreg)}</td>
                    <td className="py-2 text-right font-semibold text-primary">{r.fmt(r.gbdt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 text-xs text-muted-foreground">
              Regression glucose MAE: +30min {m.regression.maeT30.toFixed(1)} · +60min{" "}
              {m.regression.maeT60.toFixed(1)} · +120min {m.regression.maeT120.toFixed(1)} mg/dL
            </div>
          </CardContent>
        </Card>

        {/* confusion matrix */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Grid3x3 className="h-4 w-4 text-primary" /> Confusion matrix (GBDT)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-1 text-center text-sm">
              <div className="text-xs text-muted-foreground"></div>
              <div className="text-xs text-muted-foreground py-2">Pred no-spike</div>
              <div className="text-xs text-muted-foreground py-2">Pred spike</div>

              <div className="text-xs text-muted-foreground py-3 flex items-center justify-center">Actual no-spike</div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-md py-3">
                <div className="font-bold text-emerald-700">{cm.tn}</div>
                <div className="text-[10px] text-muted-foreground">TN</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-md py-3">
                <div className="font-bold text-amber-700">{cm.fp}</div>
                <div className="text-[10px] text-muted-foreground">FP</div>
              </div>

              <div className="text-xs text-muted-foreground py-3 flex items-center justify-center">Actual spike</div>
              <div className="bg-rose-50 border border-rose-200 rounded-md py-3">
                <div className="font-bold text-rose-700">{cm.fn}</div>
                <div className="text-[10px] text-muted-foreground">FN</div>
              </div>
              <div className="bg-primary/10 border border-primary/30 rounded-md py-3">
                <div className="font-bold text-primary">{cm.tp}</div>
                <div className="text-[10px] text-muted-foreground">TP</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {cmTotal} test windows · threshold {m.threshold.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ROC curve */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <LineIcon className="h-4 w-4 text-primary" /> ROC curve
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={m.rocCurve} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="fpr" domain={[0, 1]} stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => v.toFixed(1)} />
                  <YAxis domain={[0, 1]} stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={32} tickFormatter={(v) => v.toFixed(1)} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--border)" }} formatter={(v: number, n: string) => [v.toFixed(3), n === "fpr" ? "FPR" : "TPR"]} labelFormatter={() => ""} />
                  <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="tpr" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="text-xs text-muted-foreground mt-1">AUC = <span className="font-semibold text-primary">{m.gbdt.rocAuc.toFixed(3)}</span></div>
          </CardContent>
        </Card>

        {/* PR curve */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <LineIcon className="h-4 w-4 text-primary" /> Precision-Recall curve
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={m.prCurve} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="recall" domain={[0, 1]} stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => v.toFixed(1)} />
                  <YAxis domain={[0, 1]} stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={32} tickFormatter={(v) => v.toFixed(1)} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--border)" }} formatter={(v: number) => [v.toFixed(3), "Precision"]} labelFormatter={() => ""} />
                  <Line type="monotone" dataKey="precision" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="text-xs text-muted-foreground mt-1">PR-AUC = <span className="font-semibold text-primary">{m.gbdt.prAuc.toFixed(3)}</span></div>
          </CardContent>
        </Card>
      </div>

      {/* feature importance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> Feature importance (GBDT gain)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topFeatures} layout="vertical" margin={{ top: 5, right: 16, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => v.toFixed(2)} />
                <YAxis type="category" dataKey="feature" stroke="var(--muted-foreground)" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={150} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid var(--border)" }} formatter={(v: number) => [v.toFixed(3), "importance"]} labelFormatter={() => ""} />
                <Bar dataKey="importance" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* plain language explanation */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" /> How the model works (plain language)
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>
            The model looks at the last <strong>6 hours</strong> of a patient&apos;s continuous
            glucose monitor plus their heart-rate, HRV, steps, sleep and recent meals, and{" "}
            <strong>merges</strong> them with their static EHR record (age, BMI, HbA1c, medication,
            genetics). This combined snapshot is the <strong>digital twin</strong> at one moment.
          </p>
          <p>
            A <strong>gradient-boosted decision tree</strong> (80 trees, depth 4) was trained on{" "}
            {m.nSamples.toLocaleString()} such snapshots from {m.nPatients} virtual patients, split{" "}
            <strong>by patient</strong> (70/15/15) so no patient appears in both training and test —
            preventing data leakage. It learned to predict whether glucose will exceed{" "}
            <strong>180 mg/dL</strong> in the next 2 hours.
          </p>
          <p>
            On held-out patients it reaches ROC-AUC <Badge variant="secondary">{m.gbdt.rocAuc.toFixed(3)}</Badge>{" "}
            and F1 <Badge variant="secondary">{m.gbdt.f1.toFixed(3)}</Badge>, with correct alerts firing{" "}
            <strong>{m.leadTimeMin.toFixed(0)} minutes</strong> before the spike on average. Each
            prediction comes with <strong>SHAP-style reasons</strong> (tree-interpreter) showing
            which factors pushed the risk up or down.
          </p>
          <p className="text-xs italic pt-1">
            All data is synthetic. Metrics reflect performance on synthetic data only and do not
            validate clinical use.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold mt-1 ${accent ? "text-primary" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
