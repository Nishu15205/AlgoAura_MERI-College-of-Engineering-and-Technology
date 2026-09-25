"use client";
// Alert timeline — the last 24h of risk predictions, with triggered alerts highlighted.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, CheckCircle2, Bell } from "lucide-react";
import { useEffect, useState } from "react";

interface AlertEntry {
  ts: number;
  tsHuman: string;
  risk: number;
  triggered: number;
  glucoseAtT: number;
  peakGlucose: number | null;
}

export function AlertTimeline({ patientId }: { patientId: string }) {
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/patients/${patientId}/alerts`)
      .then((r) => (r.ok ? r.json() : { alerts: [] }))
      .then((d) => {
        if (!active) return;
        setAlerts(d.alerts ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setAlerts([]);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [patientId]);

  const triggered = alerts.filter((a) => a.triggered === 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          Alert Timeline
          <span className="text-xs font-normal text-muted-foreground">
            (last 24h · {triggered.length} alerts)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="text-sm text-muted-foreground">No alert history.</div>
        ) : (
          <ScrollArea className="h-72 pr-3">
            <div className="space-y-1.5">
              {alerts
                .slice()
                .reverse()
                .map((a) => {
                  const fired = a.triggered === 1;
                  const time = new Date(a.tsHuman).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  });
                  return (
                    <div
                      key={a.ts}
                      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                        fired ? "bg-rose-50 border border-rose-200" : "bg-muted/40"
                      }`}
                    >
                      <div className="shrink-0">
                        {fired ? (
                          <AlertTriangle className="h-4 w-4 text-rose-500" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        )}
                      </div>
                      <div className="shrink-0 w-12 text-xs text-muted-foreground font-mono">
                        {time}
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              a.risk > 0.6 ? "bg-rose-500" : a.risk > 0.3 ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                            style={{ width: `${a.risk * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium w-10 text-right">
                          {Math.round(a.risk * 100)}%
                        </span>
                      </div>
                      <div className="shrink-0 text-xs text-muted-foreground w-24 text-right">
                        {Math.round(a.glucoseAtT)} →{" "}
                        {a.peakGlucose ? Math.round(a.peakGlucose) : "--"} mg/dL
                      </div>
                    </div>
                  );
                })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
