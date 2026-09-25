// ============================================================================
//  Evaluation metrics: ROC-AUC, PR-AUC, precision/recall/F1 at a threshold,
//  confusion matrix, Brier score, plus ROC/PR curve points for plotting.
// ============================================================================

import type { ModelMetrics } from "./types";
import { mean } from "./stats";

/** ROC-AUC via the rank-based formula (Mann-Whitney U). */
export function rocAuc(scores: number[], labels: number[]): number {
  const n = scores.length;
  const pos = labels.filter((l) => l === 1).length;
  const neg = n - pos;
  if (pos === 0 || neg === 0) return 0.5;
  const indexed = scores.map((s, i) => ({ s, l: labels[i] })).sort((a, b) => a.s - b.s);
  // ranks with ties averaged
  const ranks = new Array(n).fill(0);
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n && indexed[j].s === indexed[i].s) j++;
    const avgRank = (i + j + 1) / 2; // 1-based average
    for (let k = i; k < j; k++) ranks[k] = avgRank;
    i = j;
  }
  let sumPosRanks = 0;
  for (let k = 0; k < n; k++) if (indexed[k].l === 1) sumPosRanks += ranks[k];
  return (sumPosRanks - (pos * (pos + 1)) / 2) / (pos * neg);
}

/** PR-AUC via trapezoidal integration of precision-recall curve. */
export function prAuc(scores: number[], labels: number[]): number {
  const indexed = scores.map((s, i) => ({ s, l: labels[i] })).sort((a, b) => b.s - a.s);
  let tp = 0;
  let fp = 0;
  const pos = labels.filter((l) => l === 1).length;
  const fn = pos;
  let area = 0;
  let prevRecall = 0;
  for (const { l } of indexed) {
    if (l === 1) tp++;
    else fp++;
    const recall = tp / (tp + fn);
    const precision = tp / (tp + fp);
    // trapezoid in (recall, precision)
    area += (recall - prevRecall) * precision;
    prevRecall = recall;
  }
  return area;
}

/** Confusion matrix at a threshold. */
export function confusionMatrix(scores: number[], labels: number[], threshold: number) {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  for (let i = 0; i < scores.length; i++) {
    const pred = scores[i] >= threshold ? 1 : 0;
    if (pred === 1 && labels[i] === 1) tp++;
    else if (pred === 1 && labels[i] === 0) fp++;
    else if (pred === 0 && labels[i] === 1) fn++;
    else tn++;
  }
  return { tp, fp, fn, tn };
}

/** Choose the threshold on the validation set that maximizes F1. */
export function bestThreshold(scores: number[], labels: number[]): number {
  const candidates = [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6];
  let best = 0.3;
  let bestF1 = 0;
  for (const t of candidates) {
    const { tp, fp, fn } = confusionMatrix(scores, labels, t);
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    if (f1 > bestF1) {
      bestF1 = f1;
      best = t;
    }
  }
  return best;
}

/** Full metric report at a threshold. */
export function reportMetrics(
  name: string,
  scores: number[],
  labels: number[],
  threshold: number
): ModelMetrics {
  const { tp, fp, fn, tn } = confusionMatrix(scores, labels, threshold);
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const accuracy = (tp + tn) / scores.length;
  const brier = mean(scores.map((s, i) => (s - labels[i]) ** 2));
  return {
    name,
    rocAuc: rocAuc(scores, labels),
    prAuc: prAuc(scores, labels),
    precision,
    recall,
    f1,
    accuracy,
    brierScore: brier,
  };
}

/** ROC curve points (for plotting). */
export function rocCurve(scores: number[], labels: number[]): { fpr: number; tpr: number }[] {
  const indexed = scores.map((s, i) => ({ s, l: labels[i] })).sort((a, b) => b.s - a.s);
  const pos = labels.filter((l) => l === 1).length;
  const neg = labels.length - pos;
  let tp = 0;
  let fp = 0;
  const points: { fpr: number; tpr: number }[] = [{ fpr: 0, tpr: 0 }];
  for (const { l } of indexed) {
    if (l === 1) tp++;
    else fp++;
    points.push({ fpr: fp / neg, tpr: tp / pos });
  }
  // decimate to ~100 points for plotting
  const decimated: { fpr: number; tpr: number }[] = [];
  const step = Math.max(1, Math.floor(points.length / 100));
  for (let i = 0; i < points.length; i += step) decimated.push(points[i]);
  decimated.push(points[points.length - 1]);
  return decimated;
}

/** PR curve points (for plotting). */
export function prCurve(scores: number[], labels: number[]): { recall: number; precision: number }[] {
  const indexed = scores.map((s, i) => ({ s, l: labels[i] })).sort((a, b) => b.s - a.s);
  let tp = 0;
  let fp = 0;
  const pos = labels.filter((l) => l === 1).length;
  const points: { recall: number; precision: number }[] = [];
  for (const { l } of indexed) {
    if (l === 1) tp++;
    else fp++;
    points.push({ recall: tp / pos, precision: tp / (tp + fp) });
  }
  points.reverse();
  const decimated: { recall: number; precision: number }[] = [];
  const step = Math.max(1, Math.floor(points.length / 100));
  for (let i = 0; i < points.length; i += step) decimated.push(points[i]);
  if (points.length) decimated.push(points[points.length - 1]);
  return decimated;
}

/** Average lead time of correct alerts: among true-positive windows, how many
 *  minutes before the actual peak did the alert fire (if it fired earlier in a
 *  contiguous alert run)? Approximated as the average distance from the alert
 *  timestamp to the peak within the horizon. */
export function averageLeadTime(
  alertRuns: { alertTs: number; peakTs: number; correct: boolean }[]
): number {
  const correct = alertRuns.filter((a) => a.correct);
  if (correct.length === 0) return 0;
  const totalMin = correct.reduce((s, a) => s + (a.peakTs - a.alertTs) / 60, 0);
  return totalMin / correct.length;
}
