// ============================================================================
//  Inference module: loads the trained GBDT (classification + regression) and
//  provides risk probability, predicted glucose curve, and human-readable
//  SHAP-style reasons for a single patient's current state.
// ============================================================================

import { GBDT } from "./gbdt";
import { LogisticRegression } from "./logistic-regression";
import { FEATURE_NAMES, computeFeatures } from "./features";
import type { EhrRecord, WearableSample, Reason } from "./types";
import * as fs from "fs";
import * as path from "path";

const ML_DIR = path.join(process.cwd(), "ml");

let clfCache: GBDT | null = null;
let regCache: GBDT | null = null;
let logregCache: LogisticRegression | null = null;
let thresholdCache = 0.3;

function loadClf(): GBDT {
  if (clfCache) return clfCache;
  const p = path.join(ML_DIR, "gbdt-classification.json");
  const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
  clfCache = GBDT.fromJSON(raw);
  return clfCache;
}
function loadReg(): GBDT {
  if (regCache) return regCache;
  const p = path.join(ML_DIR, "gbdt-regression.json");
  const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
  regCache = GBDT.fromJSON(raw);
  return regCache;
}
function loadLogReg(): LogisticRegression {
  if (logregCache) return logregCache;
  const p = path.join(ML_DIR, "logreg.json");
  if (!fs.existsSync(p)) return new LogisticRegression();
  const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
  logregCache = LogisticRegression.fromJSON(raw);
  return logregCache;
}
function loadThreshold(): number {
  if (thresholdCache) return thresholdCache;
  try {
    const m = JSON.parse(fs.readFileSync(path.join(ML_DIR, "metrics.json"), "utf-8"));
    thresholdCache = m.threshold ?? 0.3;
  } catch {
    thresholdCache = 0.3;
  }
  return thresholdCache;
}

/** Build the feature vector for the latest sample of a patient. */
export function featuresForLatest(
  samples: WearableSample[],
  ehr: EhrRecord
): { features: number[] | null; ts: number; currentGlucose: number } {
  if (samples.length < 73) return { features: null, ts: 0, currentGlucose: 0 };
  const i = samples.length - 1;
  // need horizon for label only; for inference we don't, so guard
  const features = computeFeatures(samples, ehr, i);
  return { features, ts: samples[i].ts, currentGlucose: samples[i].glucose };
}

export interface RiskPrediction {
  probability: number;
  band: "Low" | "Medium" | "High";
  threshold: number;
  reasons: Reason[];
  glucoseCurve: { t: number; glucose: number; lower: number; upper: number }[];
  predictedPeak: number;
  modelVersion: string;
}

/** Predict spike risk + glucose curve + reasons for a patient's latest state. */
export function predictRisk(
  samples: WearableSample[],
  ehr: EhrRecord
): RiskPrediction | null {
  const { features, ts, currentGlucose } = featuresForLatest(samples, ehr);
  if (!features) return null;

  const clf = loadClf();
  const reg = loadReg();
  const threshold = loadThreshold();

  const proba = clf.predictProba(features);
  const band: "Low" | "Medium" | "High" = proba < 0.3 ? "Low" : proba < 0.6 ? "Medium" : "High";

  // reasons via tree-interpreter contributions (margin space)
  const contribs = clf.contributions(features);
  const reasons = buildReasons(contribs, features).slice(0, 6);

  // glucose curve: predict +120 glucose via regression, shape via exponential approach
  const pred120 = reg.predictRaw(features);
  const pred60 = currentGlucose + (pred120 - currentGlucose) * 0.6;
  const pred30 = currentGlucose + (pred120 - currentGlucose) * 0.3;

  // residual std for confidence band (from metrics)
  let residStd = 22;
  try {
    const m = JSON.parse(fs.readFileSync(path.join(ML_DIR, "metrics.json"), "utf-8"));
    residStd = m.regression?.residualStd120 ?? 22;
  } catch {}

  const curve: { t: number; glucose: number; lower: number; upper: number }[] = [];
  for (let t = 0; t <= 120; t += 10) {
    const frac = t / 120;
    // smooth approach: 1 - exp(-3*frac)
    const k = 1 - Math.exp(-3 * frac);
    const g = currentGlucose + (pred120 - currentGlucose) * k;
    const band95 = 1.96 * residStd * Math.sqrt(frac);
    curve.push({
      t,
      glucose: Math.round(g * 10) / 10,
      lower: Math.round((g - band95) * 10) / 10,
      upper: Math.round((g + band95) * 10) / 10,
    });
  }

  return {
    probability: Math.round(proba * 1000) / 1000,
    band,
    threshold,
    reasons,
    glucoseCurve: curve,
    predictedPeak: Math.round(Math.max(currentGlucose, pred120) * 10) / 10,
    modelVersion: "gbdt-v1",
  };
}

/** Map raw feature contributions to human-readable reasons. */
function buildReasons(
  contribs: { feature: number; value: number; contribution: number }[],
  features: number[]
): Reason[] {
  const sorted = contribs
    .map((c) => ({ ...c, abs: Math.abs(c.contribution) }))
    .sort((a, b) => b.abs - a.abs);
  return sorted.map((c) => ({
    feature: FEATURE_NAMES[c.feature] ?? `f${c.feature}`,
    value: c.value,
    contribution: c.contribution,
    display: humanize(FEATURE_NAMES[c.feature] ?? `f${c.feature}`, c.value, c.contribution),
  }));
}

function humanize(name: string, value: number, contribution: number): string {
  const dir = contribution > 0 ? "raises" : "lowers";
  const short = featureShortName(name);
  switch (name) {
    case "current_glucose":
      return `Current glucose ${Math.round(value)} mg/dL ${dir} risk`;
    case "roc_30min":
      return `${value > 0 ? "Rising" : "Falling"} glucose (${Math.round(value)} mg/dL / 30min) ${dir} risk`;
    case "roc_60min":
      return `60-min trend ${value > 0 ? "up" : "down"} ${Math.round(Math.abs(value))} ${dir} risk`;
    case "last_meal_carbs":
      return value > 0 ? `Recent meal (${Math.round(value)}g carbs) ${dir} risk` : `No recent meal (${dir} risk)`;
    case "time_since_last_meal_min":
      return `${Math.round(value)} min since last meal (${dir} risk)`;
    case "rolling_steps_6h":
      return value > 800 ? `Active last 6h (${Math.round(value)} steps) ${dir} risk` : `Low activity (${dir} risk)`;
    case "rolling_hrv_mean_6h":
      return value < 30 ? `Low HRV (${Math.round(value)}ms) ${dir} risk` : `Healthy HRV (${dir} risk)`;
    case "hba1c":
      return `HbA1c ${value} ${dir} risk`;
    case "bmi":
      return `BMI ${value} ${dir} risk`;
    case "prev_night_sleep_hours":
      return value < 6 ? `Poor sleep (${value.toFixed(1)}h) ${dir} risk` : `Good sleep (${dir} risk)`;
    case "hour_of_day":
      return value >= 5 && value < 10 ? `Morning (dawn effect) ${dir} risk` : `Time of day (${dir} risk)`;
    case "glucose_above_160":
      return value === 1 ? `Glucose above 160 mg/dL ${dir} risk` : `Glucose below 160 (${dir} risk)`;
    case "insulin_sensitivity":
      return value < 0.5 ? `Low insulin sensitivity ${dir} risk` : `Higher sensitivity (${dir} risk)`;
    case "age":
      return `Age ${value} (${dir} risk)`;
    default:
      return `${short} = ${typeof value === "number" ? value.toFixed(2) : value} (${dir} risk)`;
  }
}

function featureShortName(name: string): string {
  return name
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
