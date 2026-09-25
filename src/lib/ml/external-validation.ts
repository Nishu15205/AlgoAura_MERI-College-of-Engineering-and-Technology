// ============================================================================
//  External data validation framework.
//
//  The challenge allows anonymized clinical databases (MIMIC-IV) and open-source
//  wearable datasets. This module provides a loader that ingests external CGM
//  data in a standard CSV format and runs the trained model on it, so the team
//  can demonstrate the pipeline generalizes beyond synthetic data.
//
//  Supported CSV format (MIMIC-IV `icustays` + `chartevents` derived, or
//  OhioT1DM export):
//    patient_id, ts (ISO), glucose (mg/dL), heart_rate, hrv, steps, sleep_stage
//
//  Usage:
//    bun run scripts/validate-external.ts data/external.csv
// ============================================================================

import * as fs from "fs";
import * as path from "path";
import { GBDT } from "./gbdt";
import { LogisticRegression } from "./logistic-regression";
import { computeFeatures, FEATURE_NAMES } from "./features";
import { reportMetrics, rocAuc, prAuc, confusionMatrix } from "./metrics";
import { predictRisk } from "./predict";
import type { EhrRecord, WearableSample } from "./types";
import { computeCgmMetrics } from "./cgm-metrics";

const ML_DIR = path.join(process.cwd(), "ml");

export interface ExternalRow {
  patientId: string;
  ts: string;
  glucose: number;
  heartRate: number;
  hrv: number;
  steps: number;
  sleepStage: string;
}

/** Parse an external CGM CSV into per-patient time-series. */
export function loadExternalCsv(csvPath: string): Map<string, ExternalRow[]> {
  const raw = fs.readFileSync(csvPath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim());
  if (lines.length < 2) throw new Error("CSV is empty");
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = {
    patientId: header.findIndex((h) => h.includes("patient")),
    ts: header.findIndex((h) => h.includes("ts") || h.includes("time") || h.includes("date")),
    glucose: header.findIndex((h) => h.includes("glucose") || h.includes("glu")),
    hr: header.findIndex((h) => h.includes("heart") || h.includes("hr")),
    hrv: header.findIndex((h) => h.includes("hrv")),
    steps: header.findIndex((h) => h.includes("step")),
    sleep: header.findIndex((h) => h.includes("sleep")),
  };
  const map = new Map<string, ExternalRow[]>();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const pid = cols[idx.patientId] || `ext-${i}`;
    const row: ExternalRow = {
      patientId: pid,
      ts: cols[idx.ts] || "",
      glucose: parseFloat(cols[idx.glucose]) || 0,
      heartRate: parseFloat(cols[idx.hr]) || 0,
      hrv: parseFloat(cols[idx.hrv]) || 0,
      steps: parseFloat(cols[idx.steps]) || 0,
      sleepStage: cols[idx.sleep] || "awake",
    };
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid)!.push(row);
  }
  return map;
}

/** Build a minimal EHR record for an external patient (defaults; to be filled
 *  from the external source's demographics if available). */
export function defaultEhrForExternal(patientId: string): EhrRecord {
  return {
    patientId,
    name: patientId,
    age: 55,
    sex: "male",
    bmi: 30,
    hba1c: 7.5,
    yearsSinceDiagnosis: 5,
    medication: "metformin",
    hypertension: 1,
    familyHistoryDiabetes: 1,
    geneticRiskScore: 0.5,
    fastingGlucose: 140,
    egfr: 90,
  };
}

export interface ExternalValidationResult {
  nPatients: number;
  nWindows: number;
  rocAuc: number;
  prAuc: number;
  cgmMetrics: ReturnType<typeof computeCgmMetrics>;
  samplePredictions: { patientId: string; probability: number; band: string }[];
}

/** Run the trained model on external CGM data and report metrics. */
export function validateExternal(csvPath: string): ExternalValidationResult {
  const data = loadExternalCsv(csvPath);
  const clf = GBDT.fromJSON(JSON.parse(fs.readFileSync(path.join(ML_DIR, "gbdt-classification.json"), "utf-8")));

  const allScores: number[] = [];
  const allLabels: number[] = [];
  const allGlucose: number[] = [];
  const samplePredictions: ExternalValidationResult["samplePredictions"] = [];
  let nWindows = 0;

  for (const [pid, rows] of data) {
    if (rows.length < 73) continue; // need 6h lookback
    const ehr = defaultEhrForExternal(pid);
    const samples: WearableSample[] = rows.map((r) => ({
      patientId: pid,
      ts: Math.floor(new Date(r.ts).getTime() / 1000) || 0,
      tsHuman: r.ts,
      glucose: r.glucose,
      heartRate: r.heartRate,
      hrvRmssd: r.hrv,
      steps: r.steps,
      sleepStage: (r.sleepStage as any) || "awake",
      mealCarbsG: 0,
      activityMin: 0,
    }));
    // glucose for CGM metrics
    for (const s of samples) allGlucose.push(s.glucose);
    // prediction at the latest window
    const pred = predictRisk(samples, ehr);
    if (pred) {
      samplePredictions.push({ patientId: pid, probability: pred.probability, band: pred.band });
    }
    // sliding-window labels
    const HORIZON = 24;
    for (let i = 72; i + HORIZON < samples.length; i += 6) {
      const feats = computeFeatures(samples, ehr, i);
      if (!feats) continue;
      allScores.push(clf.predictProba(feats));
      let peak = 0;
      for (let k = i + 1; k <= i + HORIZON; k++) if (samples[k].glucose > peak) peak = samples[k].glucose;
      allLabels.push(peak > 180 ? 1 : 0);
      nWindows++;
    }
  }

  return {
    nPatients: data.size,
    nWindows,
    rocAuc: allLabels.length > 0 ? rocAuc(allScores, allLabels) : 0,
    prAuc: allLabels.length > 0 ? prAuc(allScores, allLabels) : 0,
    cgmMetrics: computeCgmMetrics(allGlucose),
    samplePredictions: samplePredictions.slice(0, 10),
  };
}
