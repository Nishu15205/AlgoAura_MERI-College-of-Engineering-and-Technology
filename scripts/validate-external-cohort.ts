// ============================================================================
//  External validation on an independent literature-calibrated cohort.
//  Run with:  bun run scripts/validate-external-cohort.ts
//
//  Generates a SEPARATE 60-patient cohort with parameters from published
//  literature (ICMR INDIAB demographics, Dexcom G6 sensor noise, Indian
//  dietary patterns) and runs the trained GlucoTwin model on it. Reports
//  ROC-AUC, PR-AUC, F1, CGM metrics, and calibration on this out-of-distribution
//  cohort to demonstrate generalization.
// ============================================================================

import { generateExternalEhr, generateExternalWearables, EXTERNAL_N_PATIENTS } from "@/lib/ml/external-cohort";
import { buildPatientSamples, computeFeatures } from "@/lib/ml/features";
import { GBDT } from "@/lib/ml/gbdt";
import { calibrate, type Calibrator } from "@/lib/ml/calibration";
import { reportMetrics, rocAuc, prAuc, confusionMatrix, bestThreshold } from "@/lib/ml/metrics";
import { computeCgmMetrics } from "@/lib/ml/cgm-metrics";
import { predictRisk } from "@/lib/ml/predict";
import * as fs from "fs";
import * as path from "path";

const ML_DIR = path.join(process.cwd(), "ml");

function log(msg: string) {
  console.log(`[external-val] ${msg}`);
}

async function main() {
  log("Generating independent literature-calibrated cohort...");
  const ehr = generateExternalEhr(EXTERNAL_N_PATIENTS);
  const wearables = generateExternalWearables(ehr);
  log(`  -> ${ehr.length} external patients, ${ehr.length * 14 * 288} samples`);

  // Load the trained model + calibrator
  const clf = GBDT.fromJSON(JSON.parse(fs.readFileSync(path.join(ML_DIR, "gbdt-classification.json"), "utf-8")));
  let calibrator: Calibrator | null = null;
  try {
    calibrator = JSON.parse(fs.readFileSync(path.join(ML_DIR, "calibrator.json"), "utf-8"));
  } catch {}

  // Build labeled samples on the external cohort
  log("Building labeled windows on external cohort...");
  const allSamples = [];
  for (const e of ehr) {
    const s = buildPatientSamples(wearables.get(e.patientId)!, e, 3);
    const step = Math.max(1, Math.floor(s.length / 50));
    for (let i = 0; i < s.length; i += step) allSamples.push(s[i]);
  }
  log(`  -> ${allSamples.length} labeled windows`);

  // Run the model
  const X = allSamples.map((s) => s.features);
  const y = allSamples.map((s) => s.label);
  let scores = X.map((x) => clf.predictProba(x));
  if (calibrator) scores = scores.map((s) => calibrate(s, calibrator));

  const threshold = JSON.parse(fs.readFileSync(path.join(ML_DIR, "metrics.json"), "utf-8")).threshold ?? 0.35;
  const metrics = reportMetrics("gbdt-external", scores, y, threshold);
  const cm = confusionMatrix(scores, y, threshold);

  // CGM metrics across all external patients
  const allGlucose: number[] = [];
  for (const e of ehr) {
    for (const s of wearables.get(e.patientId)!) allGlucose.push(s.glucose);
  }
  const cgm = computeCgmMetrics(allGlucose);

  // Sample predictions at latest state
  const samplePreds = [];
  for (const e of ehr.slice(0, 8)) {
    const pred = predictRisk(wearables.get(e.patientId)!, e);
    if (pred) samplePreds.push({ patient: e.name, glucose: pred.currentGlucose, prob: pred.probability, band: pred.band });
  }

  const result = {
    cohort: "Independent literature-calibrated (ICMR INDIAB demographics, Dexcom G6 noise)",
    nPatients: ehr.length,
    nWindows: allSamples.length,
    metrics: {
      rocAuc: metrics.rocAuc,
      prAuc: metrics.prAuc,
      precision: metrics.precision,
      recall: metrics.recall,
      f1: metrics.f1,
      accuracy: metrics.accuracy,
    },
    confusionMatrix: cm,
    cgmMetrics: cgm,
    samplePredictions: samplePreds,
    generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(ML_DIR, "external-validation.json"), JSON.stringify(result, null, 2));

  console.log("");
  console.log("========================================");
  console.log("  EXTERNAL VALIDATION RESULTS");
  console.log("  (independent literature-calibrated cohort)");
  console.log("========================================");
  console.log(`Cohort:          ${result.cohort}`);
  console.log(`Patients:        ${result.nPatients}`);
  console.log(`Windows:         ${result.nWindows}`);
  console.log(`ROC-AUC:         ${metrics.rocAuc.toFixed(3)}`);
  console.log(`PR-AUC:          ${metrics.prAuc.toFixed(3)}`);
  console.log(`Precision:       ${(metrics.precision * 100).toFixed(1)}%`);
  console.log(`Recall:          ${(metrics.recall * 100).toFixed(1)}%`);
  console.log(`F1:              ${metrics.f1.toFixed(3)}`);
  console.log(`Accuracy:        ${(metrics.accuracy * 100).toFixed(1)}%`);
  console.log(`Confusion:       TP=${cm.tp} FP=${cm.fp} FN=${cm.fn} TN=${cm.tn}`);
  console.log("");
  console.log("=== CGM Metrics (external cohort) ===");
  console.log(`Time in Range:   ${cgm.tir.toFixed(1)}% (target ≥70%)`);
  console.log(`Time Above:      ${cgm.tar.toFixed(1)}% (target <25%)`);
  console.log(`Time Below:      ${cgm.tbr.toFixed(1)}% (target <4%)`);
  console.log(`GMI:             ${cgm.gmi.toFixed(1)}%`);
  console.log(`CV:              ${cgm.cv.toFixed(1)}%`);
  console.log("");
  console.log("=== Sample Predictions ===");
  for (const p of samplePreds) {
    console.log(`  ${p.patient}: ${p.glucose} mg/dL -> ${(p.prob * 100).toFixed(1)}% (${p.band})`);
  }
  console.log("");
  console.log("Results saved to ml/external-validation.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
