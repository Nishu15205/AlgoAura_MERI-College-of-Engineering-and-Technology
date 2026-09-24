// ============================================================================
//  Twin Simulator — the "what-if" engine. Given a patient's current state and a
//  hypothetical action (meal carbs, walk minutes, sleep hours, medication
//  skipped), it simulates the next 3 hours of glucose using a simple
//  physiological model (meal absorption + insulin clearance + exercise effect +
//  medication effect) and returns baseline vs what-if curves.
//  The same model family used to generate synthetic data, so the simulation is
//  consistent with the data distribution the ML model was trained on.
// ============================================================================

import type { EhrRecord } from "./types";
import { insulinProfile } from "./data-generator";
import { clamp } from "./stats";
import { RNG } from "./rng";

export interface CurrentState {
  glucose: number; // mg/dL now
  minuteOfDay: number; // 0..1439
  recentRoc60: number; // glucose change over last 60 min (mg/dL)
  dayBaseline: number; // fasting-ish baseline today
}

export interface WhatIfAction {
  carbsG: number; // grams of carbs in a meal starting now (0 = no meal)
  walkMinutes: number; // minutes of walking starting in ~15 min
  sleepHours: number; // last night's sleep (affects baseline sensitivity)
  skipMedication: boolean; // if true, remove medication effect for the sim
}

export interface SimulationResult {
  baseline: { t: number; glucose: number }[]; // t in minutes from now (0..180)
  whatIf: { t: number; glucose: number }[];
  baselinePeak: number;
  whatIfPeak: number;
  baselineRiskBand: "Low" | "Medium" | "High";
  whatIfRiskBand: "Low" | "Medium" | "High";
  baselineSpikeProb: number;
  whatIfSpikeProb: number;
  deltaRisk: number;
  summary: string;
}

const STEP_MIN = 5;
const N_STEPS = 36; // 3 hours

export function simulateWhatIf(
  ehr: EhrRecord,
  state: CurrentState,
  action: WhatIfAction,
  baselineRiskProb: number // from the ML model for the current state
): SimulationResult {
  const rng = new RNG(98765);
  // derive effective insulin profile (optionally drop medication)
  let { insulinSensitivity, medClearanceBoost, medMealReduction } = insulinProfile(ehr);
  if (action.skipMedication) {
    medClearanceBoost = 0;
    medMealReduction = 0;
    // dropping medication worsens sensitivity slightly
    insulinSensitivity = clamp(insulinSensitivity - 0.1, 0.2, 0.95);
  }

  // sleep hours adjust baseline sensitivity (poor sleep -> higher baseline)
  const sleepAdjust = clamp((7 - action.sleepHours) * 4, -8, 16);
  const baseLine = state.dayBaseline + sleepAdjust;

  const run = (useAction: boolean): { t: number; glucose: number }[] => {
    let glucose = state.glucose;
    let gutCarbs = useAction ? action.carbsG : 0; // baseline = no extra meal
    const out: { t: number; glucose: number }[] = [{ t: 0, glucose: Math.round(glucose * 10) / 10 }];
    const absorptionRate = 0.07;
    const carbsToGlucose = (1.7 * (1 - medMealReduction)) / insulinSensitivity;
    const clearance = (0.05 + medClearanceBoost) * insulinSensitivity;
    // momentum from recent trend (decays)
    let momentum = state.recentRoc60 * 0.3;

    for (let step = 1; step <= N_STEPS; step++) {
      const t = step * STEP_MIN;
      const hour = ((state.minuteOfDay + t) / 60) % 24;
      // meal absorption
      const absorbed = gutCarbs * absorptionRate;
      gutCarbs = Math.max(0, gutCarbs - absorbed);
      const dGut = absorbed * carbsToGlucose;
      // clearance toward baseline
      const dClear = (glucose - baseLine) * clearance;
      // dawn
      let dDawn = 0;
      if (hour >= 4 && hour < 8) dDawn = (ehr.hba1c - 6.5) * 0.6 * (1 - Math.abs(hour - 6) / 2);
      // exercise: walk starts ~15 min in, lasts walkMinutes
      let dExercise = 0;
      if (useAction && action.walkMinutes > 0 && t >= 15 && t < 15 + action.walkMinutes) {
        dExercise = -STEP_MIN * (0.35 + 0.2 * (1 - insulinSensitivity));
      }
      // momentum decay
      momentum *= 0.85;
      glucose = glucose + dGut - dClear + dDawn + dExercise + momentum * 0.1 + rng.gaussian(0, 1.5);
      glucose = clamp(glucose, 40, 400);
      out.push({ t, glucose: Math.round(glucose * 10) / 10 });
    }
    return out;
  };

  const baseline = run(false);
  const whatIf = run(true);

  const baselinePeak = Math.max(...baseline.map((p) => p.glucose));
  const whatIfPeak = Math.max(...whatIf.map((p) => p.glucose));

  // map peak to a risk probability proxy using the ML model's current risk
  // (we blend the model's current risk with the simulated peak distance to 180)
  const probFromPeak = (peak: number) => clamp((peak - 150) / 80, 0.02, 0.98);
  const baselineSpikeProb = clamp(0.5 * baselineRiskProb + 0.5 * probFromPeak(baselinePeak), 0.01, 0.99);
  const whatIfSpikeProb = clamp(0.5 * baselineRiskProb + 0.5 * probFromPeak(whatIfPeak), 0.01, 0.99);

  const band = (p: number): "Low" | "Medium" | "High" =>
    p < 0.3 ? "Low" : p < 0.6 ? "Medium" : "High";

  const deltaRisk = whatIfSpikeProb - baselineSpikeProb;

  let summary: string;
  if (action.carbsG > 0 && action.walkMinutes === 0) {
    summary = `A ${action.carbsG}g meal is predicted to raise peak glucose to ${Math.round(whatIfPeak)} mg/dL (${Math.round(whatIfSpikeProb * 100)}% spike risk).`;
  } else if (action.walkMinutes > 0 && action.carbsG === 0) {
    summary = `${action.walkMinutes} min of walking is predicted to lower peak glucose to ${Math.round(whatIfPeak)} mg/dL (${Math.round(whatIfSpikeProb * 100)}% spike risk).`;
  } else if (action.skipMedication) {
    summary = `Skipping medication raises predicted peak to ${Math.round(whatIfPeak)} mg/dL (${Math.round(whatIfSpikeProb * 100)}% spike risk).`;
  } else if (action.carbsG > 0 && action.walkMinutes > 0) {
    summary = `Meal ${action.carbsG}g + ${action.walkMinutes}min walk → peak ${Math.round(whatIfPeak)} mg/dL (${Math.round(whatIfSpikeProb * 100)}% spike risk).`;
  } else {
    summary = `Predicted peak glucose ${Math.round(whatIfPeak)} mg/dL (${Math.round(whatIfSpikeProb * 100)}% spike risk).`;
  }

  return {
    baseline,
    whatIf,
    baselinePeak,
    whatIfPeak,
    baselineRiskBand: band(baselineSpikeProb),
    whatIfRiskBand: band(whatIfSpikeProb),
    baselineSpikeProb,
    whatIfSpikeProb,
    deltaRisk,
    summary,
  };
}
