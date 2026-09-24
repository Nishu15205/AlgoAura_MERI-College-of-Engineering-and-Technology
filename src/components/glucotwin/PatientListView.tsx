"use client";
// Patient List view — searchable, filterable table of all virtual patients
// with their latest glucose and risk badge. Clicking a row opens the twin view.
import { useEffect, useMemo, useState } from "react";
import { fetchPatients } from "./api";
import type { PatientSummary, RiskBand } from "./types";
import { RiskBadge } from "./RiskBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Activity, Droplet, Users } from "lucide-react";

export function PatientListView({
  onSelect,
}: {
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [band, setBand] = useState<RiskBand | "">("");
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const ctrl = new AbortController();
    fetchPatients({ search, band: band || undefined }, ctrl.signal)
      .then((d) => {
        if (!active) return;
        setPatients(d.patients);
        setError(null);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        if (e.name !== "AbortError") {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
      ctrl.abort();
    };
  }, [search, band]);

  const counts = useMemo(() => {
    const c = { Low: 0, Medium: 0, High: 0 };
    for (const p of patients) c[p.latestRiskBand]++;
    return c;
  }, [patients]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Patients" value={patients.length} tint="text-teal-600" />
        <StatCard icon={Activity} label="High risk" value={counts.High} tint="text-rose-600" />
        <StatCard icon={Droplet} label="Medium risk" value={counts.Medium} tint="text-amber-600" />
        <StatCard icon={Activity} label="Low risk" value={counts.Low} tint="text-emerald-600" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <CardTitle className="text-base">Virtual Patients</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search name or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 w-full sm:w-56"
                />
              </div>
              <div className="flex gap-1">
                {(["", "Low", "Medium", "High"] as const).map((b) => (
                  <Button
                    key={b || "all"}
                    size="sm"
                    variant={band === b ? "default" : "outline"}
                    onClick={() => setBand(b)}
                    className="h-9 text-xs"
                  >
                    {b || "All"}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="p-6 text-sm text-rose-600">Error: {error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Patient</th>
                    <th className="px-4 py-2 font-medium">Age / Sex</th>
                    <th className="px-4 py-2 font-medium">HbA1c</th>
                    <th className="px-4 py-2 font-medium">Medication</th>
                    <th className="px-4 py-2 font-medium text-right">Glucose</th>
                    <th className="px-4 py-2 font-medium">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i} className="border-b">
                          <td className="px-4 py-3" colSpan={6}>
                            <Skeleton className="h-6 w-full" />
                          </td>
                        </tr>
                      ))
                    : patients.map((p) => (
                        <tr
                          key={p.id}
                          onClick={() => onSelect(p.id)}
                          className="border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium">{p.name}</div>
                            <div className="text-xs text-muted-foreground">{p.id}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {p.age} / {p.sex}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium">{p.hba1c}</span>
                            <span className="text-xs text-muted-foreground">%</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {p.medication}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-semibold">{Math.round(p.latestGlucose)}</span>
                            <span className="text-xs text-muted-foreground"> mg/dL</span>
                          </td>
                          <td className="px-4 py-3">
                            <RiskBadge band={p.latestRiskBand} probability={p.latestRisk} />
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
              {!loading && patients.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No patients match your filters.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tint: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-muted ${tint}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="text-xs text-muted-foreground mt-1">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
