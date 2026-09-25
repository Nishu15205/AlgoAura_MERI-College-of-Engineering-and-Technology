// ============================================================================
//  Model calibration — maps raw model probabilities to calibrated probabilities
//  using Platt scaling (a 2-parameter logistic fit on the validation set).
//  Critical for clinical use: a "70% risk" should mean 70 of 100 such patients
//  actually spike. Also computes a calibration curve for the dashboard.
// ============================================================================

import { mean } from "./stats";

export interface Calibrator {
  a: number; // Platt slope
  b: number; // Platt intercept
}

export interface CalibrationBin {
  predicted: number; // mean predicted proba in bin
  observed: number; // fraction of positives in bin
  count: number;
}

/** Fit Platt scaling (logistic regression on 1 feature: the raw probability). */
export function fitCalibrator(scores: number[], labels: number[]): Calibrator {
  // Optimize a, b to minimize NLL of sigmoid(a*s + b) vs labels via gradient descent.
  let a = 1;
  let b = 0;
  const lr = 0.5;
  const epochs = 500;
  for (let ep = 0; ep < epochs; ep++) {
    let ga = 0;
    let gb = 0;
    for (let i = 0; i < scores.length; i++) {
      const z = a * scores[i] + b;
      const p = 1 / (1 + Math.exp(-z));
      const err = p - labels[i];
      ga += err * scores[i];
      gb += err;
    }
    a -= (lr * ga) / scores.length;
    b -= (lr * gb) / scores.length;
  }
  return { a, b };
}

/** Apply calibration to a raw probability. */
export function calibrate(p: number, cal: Calibrator): number {
  const z = cal.a * p + cal.b;
  return 1 / (1 + Math.exp(-z));
}

/** Compute a calibration curve: bin predictions, compare predicted vs observed. */
export function calibrationCurve(
  scores: number[],
  labels: number[],
  nBins = 10
): CalibrationBin[] {
  const bins: CalibrationBin[] = [];
  const edges: number[] = [];
  for (let i = 0; i <= nBins; i++) edges.push(i / nBins);
  for (let i = 0; i < nBins; i++) {
    const lo = edges[i];
    const hi = edges[i + 1];
    const inBin = scores
      .map((s, idx) => ({ s, l: labels[idx] }))
      .filter((x) => x.s > lo && (i === nBins - 1 ? x.s <= hi : x.s <= hi));
    if (inBin.length === 0) {
      bins.push({ predicted: (lo + hi) / 2, observed: 0, count: 0 });
      continue;
    }
    const predicted = mean(inBin.map((x) => x.s));
    const observed = mean(inBin.map((x) => x.l));
    bins.push({ predicted, observed, count: inBin.length });
  }
  return bins;
}

/** Expected Calibration Error (ECE) — lower is better. */
export function expectedCalibrationError(bins: CalibrationBin[]): number {
  const total = bins.reduce((s, b) => s + b.count, 0) || 1;
  return bins.reduce((s, b) => s + (b.count / total) * Math.abs(b.predicted - b.observed), 0);
}
