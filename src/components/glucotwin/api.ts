// Tiny fetch helpers for the GlucoTwin API. Plain async functions + AbortController
// for cancellation. Kept simple on purpose (beginner-readable).

import type {
  PatientSummary,
  EhrPatient,
  WearablePoint,
  RiskPrediction,
  WhatIfResult,
  ModelMetricsData,
  RiskBand,
} from "./types";

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed (${res.status}): ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function fetchPatients(
  opts: { search?: string; band?: RiskBand | ""; limit?: number } = {},
  signal?: AbortSignal
): Promise<{ count: number; patients: PatientSummary[] }> {
  const params = new URLSearchParams();
  if (opts.search) params.set("search", opts.search);
  if (opts.band) params.set("band", opts.band);
  if (opts.limit) params.set("limit", String(opts.limit));
  const q = params.toString();
  return getJson(`/api/patients${q ? "?" + q : ""}`, signal);
}

export function fetchPatient(id: string): Promise<{ patient: EhrPatient }> {
  return getJson(`/api/patients/${id}`);
}

export function fetchTimeseries(
  id: string,
  hours = 24
): Promise<{ patientId: string; hours: number; samples: WearablePoint[] }> {
  return getJson(`/api/patients/${id}/timeseries?hours=${hours}`);
}

export function fetchRisk(id: string): Promise<RiskPrediction> {
  return getJson(`/api/patients/${id}/risk`);
}

export async function postWhatIf(
  id: string,
  action: { carbs_g: number; walk_minutes: number; sleep_hours: number; skip_medication: boolean }
): Promise<WhatIfResult> {
  const res = await fetch(`/api/patients/${id}/whatif`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Simulation failed (${res.status}): ${text || res.statusText}`);
  }
  return res.json();
}

export function fetchMetrics(): Promise<ModelMetricsData> {
  return getJson(`/api/model/metrics`);
}

export function bandColor(band: RiskBand): string {
  switch (band) {
    case "Low":
      return "text-emerald-600 bg-emerald-50 border-emerald-200";
    case "Medium":
      return "text-amber-600 bg-amber-50 border-amber-200";
    case "High":
      return "text-rose-600 bg-rose-50 border-rose-200";
  }
}

export function bandDot(band: RiskBand): string {
  switch (band) {
    case "Low":
      return "bg-emerald-500";
    case "Medium":
      return "bg-amber-500";
    case "High":
      return "bg-rose-500";
  }
}

export function fmtGlucose(g: number): string {
  return Math.round(g).toString();
}
