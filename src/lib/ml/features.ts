// ============================================================================
//  Feature engineering: fuses static EHR data with the last 6 hours of dynamic
//  wearable (CGM) data into a single feature vector. The SAME function is used
//  for training (sliding windows) and live inference, so train/serve skew is
//  impossible by construction.
//
//  Label: 1 if max glucose in the NEXT 120 min (24 samples) > 180 mg/dL.
// ============================================================================

import type { EhrRecord, WearableSample, LabeledSample } from "./types";
import { mean, std, minVal, maxVal, sum } from "./stats";
import { SAMPLE_INTERVAL_MIN, insulinProfile } from "./data-generator";

export const SPIKE_THRESHOLD = 180; // mg/dL
export const LOOKBACK_MIN = 360; // 6 hours
export const HORIZON_MIN = 120; // next 2 hours
const LOOKBACK_STEPS = LOOKBACK_MIN / SAMPLE_INTERVAL_MIN; // 72
const HORIZON_STEPS = HORIZON_MIN / SAMPLE_INTERVAL_MIN; // 24

/** Canonical ordered list of feature names (the contract for train + serve). */
export const FEATURE_NAMES: string[] = [
  // ---- dynamic CGM features (last 6h) ----
  "current_glucose",
  "roc_15min",
  "roc_30min",
  "roc_60min",
  "rolling_mean_6h",
  "rolling_std_6h",
  "rolling_min_6h",
  "rolling_max_6h",
  "glucose_range_6h",
  "time_since_last_meal_min",
  "last_meal_carbs",
  "rolling_steps_6h",
  "rolling_hr_mean_6h",
  "rolling_hrv_mean_6h",
  "prev_night_sleep_hours",
  "prev_night_deep_pct",
  "hour_of_day",
  "is_morning",
  "glucose_above_160",
  // ---- static EHR features (the fusion) ----
  "age",
  "sex_male",
  "bmi",
  "hba1c",
  "years_since_diagnosis",
  "med_none",
  "med_metformin",
  "med_insulin",
  "hypertension",
  "family_history",
  "genetic_risk_score",
  "fasting_glucose",
  "egfr",
  "insulin_sensitivity",
];

/** Compute the feature vector for one time index `i` within a patient's series.
 *  Only needs the 6-hour LOOKBACK window (not the future horizon), so it works at
 *  the latest sample for live inference. The horizon guard lives in
 *  buildPatientSamples (which creates labels). */
export function computeFeatures(
  samples: WearableSample[],
  ehr: EhrRecord,
  i: number
): number[] | null {
  if (i < LOOKBACK_STEPS || i >= samples.length) return null;

  const window = samples.slice(i - LOOKBACK_STEPS + 1, i + 1); // 72 samples ending at i
  const now = samples[i];
  const currentGlucose = now.glucose;

  const glucoseSeries = window.map((s) => s.glucose);
  const steps3 = i - 3 >= 0 ? samples[i - 3].glucose : currentGlucose;
  const steps6 = i - 6 >= 0 ? samples[i - 6].glucose : currentGlucose;
  const steps12 = i - 12 >= 0 ? samples[i - 12].glucose : currentGlucose;

  const roc15 = currentGlucose - steps3;
  const roc30 = currentGlucose - steps6;
  const roc60 = currentGlucose - steps12;

  const rollingMean = mean(glucoseSeries);
  const rollingStd = std(glucoseSeries);
  const rollingMin = minVal(glucoseSeries);
  const rollingMax = maxVal(glucoseSeries);

  // time since last meal + last meal carbs (search backward up to 6h)
  let timeSinceMeal = 360; // default 6h if no meal
  let lastMealCarbs = 0;
  for (let k = i; k >= Math.max(0, i - LOOKBACK_STEPS); k--) {
    if (samples[k].mealCarbsG > 0) {
      timeSinceMeal = (i - k) * SAMPLE_INTERVAL_MIN;
      lastMealCarbs = samples[k].mealCarbsG;
      break;
    }
  }

  const rollingSteps = sum(window.map((s) => s.steps));
  const rollingHr = mean(window.map((s) => s.heartRate));
  const rollingHrv = mean(window.map((s) => s.hrvRmssd));

  // previous night sleep (look back to ~23:00-07:00 of the previous night)
  const { sleepHours, deepPct } = prevNightSleep(samples, i);

  const date = new Date(now.ts * 1000);
  const hourOfDay = date.getUTCHours() + date.getUTCMinutes() / 60;
  const isMorning = hourOfDay >= 5 && hourOfDay < 10 ? 1 : 0;

  const { insulinSensitivity } = insulinProfile(ehr);

  return [
    currentGlucose,
    roc15,
    roc30,
    roc60,
    rollingMean,
    rollingStd,
    rollingMin,
    rollingMax,
    rollingMax - rollingMin,
    timeSinceMeal,
    lastMealCarbs,
    rollingSteps,
    rollingHr,
    rollingHrv,
    sleepHours,
    deepPct,
    hourOfDay,
    isMorning,
    currentGlucose > 160 ? 1 : 0,
    // static
    ehr.age,
    ehr.sex === "male" ? 1 : 0,
    ehr.bmi,
    ehr.hba1c,
    ehr.yearsSinceDiagnosis,
    ehr.medication === "none" ? 1 : 0,
    ehr.medication === "metformin" ? 1 : 0,
    ehr.medication === "metformin+insulin" ? 1 : 0,
    ehr.hypertension,
    ehr.familyHistoryDiabetes,
    ehr.geneticRiskScore,
    ehr.fastingGlucose,
    ehr.egfr,
    insulinSensitivity,
  ];
}

/** Estimate previous night sleep hours + deep-sleep % from the lookback window. */
function prevNightSleep(samples: WearableSample[], i: number): {
  sleepHours: number;
  deepPct: number;
} {
  // look back up to 12h
  const start = Math.max(0, i - (12 * 60) / SAMPLE_INTERVAL_MIN);
  let sleepCount = 0;
  let deepCount = 0;
  let total = 0;
  for (let k = start; k <= i; k++) {
    total++;
    const st = samples[k].sleepStage;
    if (st !== "awake") {
      sleepCount++;
      if (st === "deep") deepCount++;
    }
  }
  const sleepHours = (sleepCount * SAMPLE_INTERVAL_MIN) / 60;
  const deepPct = sleepCount > 0 ? deepCount / sleepCount : 0;
  return { sleepHours, deepPct };
}

/** Build labeled samples for one patient by sliding over valid time indices. */
export function buildPatientSamples(
  samples: WearableSample[],
  ehr: EhrRecord,
  stride = 2
): LabeledSample[] {
  const out: LabeledSample[] = [];
  for (let i = LOOKBACK_STEPS; i + HORIZON_STEPS < samples.length; i += stride) {
    const features = computeFeatures(samples, ehr, i);
    if (!features) continue;
    // label: max glucose in next 120 min > 180
    let peak = 0;
    for (let k = i + 1; k <= i + HORIZON_STEPS; k++) {
      if (samples[k].glucose > peak) peak = samples[k].glucose;
    }
    const label = peak > SPIKE_THRESHOLD ? 1 : 0;
    out.push({
      patientId: ehr.patientId,
      ts: samples[i].ts,
      features,
      label,
      glucoseT30: samples[i + 6].glucose,
      glucoseT60: samples[i + 12].glucose,
      glucoseT120: samples[i + 24].glucose,
      currentGlucose: samples[i].glucose,
    });
  }
  return out;
}
