"use client";
// CGM Metrics panel — standard ambulatory glucose profile (AGP) metrics:
// Time in Range, Time Above Range, Time Below Range, GMI, CV.
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Gauge, CheckCircle2, AlertCircle } from "lucide-react";

interface CgmListEntry {
  label: string;
  value: string;
  target: string;
  ok: boolean;
}

export function CgmMetricsPanel({ patientId }: { patientId: string }) {
  const [data, setData] = useState<CgmListEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/patients/${patientId}/cgm-metrics`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setData(d.list);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setData(null);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [patientId]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          CGM Metrics (AGP)
          <span className="text-xs font-normal text-muted-foreground">· last 3 days</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : !data ? (
          <div className="text-sm text-muted-foreground">No CGM data.</div>
        ) : (
          <div className="space-y-2">
            {data.map((m) => (
              <div key={m.label} className="flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2 flex-1">
                  {m.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                  )}
                  <span className="text-muted-foreground">{m.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{m.value}</span>
                  <span className="text-xs text-muted-foreground w-16 text-right">{m.target}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
