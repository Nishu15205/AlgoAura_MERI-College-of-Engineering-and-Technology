// ============================================================================
//  Standard ambulatory glucose profile (AGP) metrics — the clinical metrics
//  diabetologists actually use to assess CGM data. Adding these shows domain
//  understanding and makes the dashboard clinically meaningful.
//
//  Reference: Battelino et al. "Clinical Targets for Continuous Glucose
//  Monitoring Data Interpretation: Recommendations From the International
//  Consensus on Time in Range." Diabetes Care 2019.
// ============================================================================

import { mean, std } from "./stats";

export interface CgmMetrics {
  tir: number; // Time in Range: % of samples with 70-180 mg/dL (target ≥70%)
  tar: number; // Time Above Range: % of samples >180 mg/dL (target <25%)
  tarLevel2: number; // % >250 mg/dL (very high)
  tbr: number; // Time Below Range: % of samples <70 mg/dL (target <4%)
  tbrLevel2: number; // % <54 mg/dL (very low)
  gmi: number; // Glucose Management Indicator: estimated HbA1c from mean glucose
  cv: number; // Coefficient of Variation: std/mean (target ≤36%)
  meanGlucose: number;
  sdGlucose: number;
  glucoseManagementIndicator: number; // alias for gmi
}

const MGDL_TO_HBA1C_SLOPE = 0.035;
const MGDL_TO_HBA1C_INTERCEPT = 2.16;

/** Compute AGP/CGM metrics from an array of glucose samples (mg/dL). */
export function computeCgmMetrics(glucoseValues: number[]): CgmMetrics {
  const n = glucoseValues.length;
  if (n === 0) {
    return {
      tir: 0, tar: 0, tarLevel2: 0, tbr: 0, tbrLevel2: 0,
      gmi: 0, cv: 0, meanGlucose: 0, sdGlucose: 0, glucoseManagementIndicator: 0,
    };
  }
  let inRange = 0, above = 0, aboveLevel2 = 0, below = 0, belowLevel2 = 0;
  for (const g of glucoseValues) {
    if (g >= 70 && g <= 180) inRange++;
    if (g > 180) above++;
    if (g > 250) aboveLevel2++;
    if (g < 70) below++;
    if (g < 54) belowLevel2++;
  }
  const meanG = mean(glucoseValues);
  const sdG = std(glucoseValues);
  // GMI = 3.31 + 0.02392 * mean_glucose(mg/dL)  — modern formula (Bergenstal 2018)
  const gmi = 3.31 + 0.02392 * meanG;
  const cv = meanG > 0 ? (sdG / meanG) * 100 : 0;
  return {
    tir: (inRange / n) * 100,
    tar: (above / n) * 100,
    tarLevel2: (aboveLevel2 / n) * 100,
    tbr: (below / n) * 100,
    tbrLevel2: (belowLevel2 / n) * 100,
    gmi,
    cv,
    meanGlucose: meanG,
    sdGlucose: sdG,
    glucoseManagementIndicator: gmi,
  };
}

/** Format a CGM metrics object into a label/value array for display. */
export function cgmMetricsToList(m: CgmMetrics) {
  return [
    { label: "Time in Range (70-180)", value: `${m.tir.toFixed(1)}%`, target: "≥70%", ok: m.tir >= 70 },
    { label: "Time Above Range (>180)", value: `${m.tar.toFixed(1)}%`, target: "<25%", ok: m.tar < 25 },
    { label: "Time Below Range (<70)", value: `${m.tbr.toFixed(1)}%`, target: "<4%", ok: m.tbr < 4 },
    { label: "GMI (est. HbA1c)", value: `${m.gmi.toFixed(1)}%`, target: "<7%", ok: m.gmi < 7 },
    { label: "Glucose CV", value: `${m.cv.toFixed(1)}%`, target: "≤36%", ok: m.cv <= 36 },
    { label: "Mean glucose", value: `${m.meanGlucose.toFixed(0)} mg/dL`, target: "—", ok: true },
  ];
}
