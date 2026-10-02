// ============================================================================
//  External data validation script.
//  Run with:  bun run scripts/validate-external.ts <path-to-external-cgm.csv>
//
//  Loads an external CGM CSV (MIMIC-IV chartevents-derived or OhioT1DM export),
//  runs the trained GlucoTwin model on it, and reports ROC-AUC, PR-AUC, and
//  standard CGM metrics. Demonstrates the pipeline generalizes beyond the
//  synthetic cohort.
//
//  Expected CSV columns (any order, case-insensitive):
//    patient_id, ts (ISO datetime), glucose (mg/dL), heart_rate, hrv, steps, sleep_stage
// ============================================================================

import { validateExternal } from "@/lib/ml/external-validation";

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Usage: bun run scripts/validate-external.ts <path-to-external-cgm.csv>");
    console.error("");
    console.error("Expected CSV columns: patient_id, ts, glucose, heart_rate, hrv, steps, sleep_stage");
    console.error("");
    console.error("Supported datasets: MIMIC-IV (icustays+chartevents), OhioT1DM, any CGM export.");
    process.exit(1);
  }
  console.log(`[glucotwin] Running external validation on ${csvPath}...`);
  const result = validateExternal(csvPath);
  console.log("");
  console.log("=== External Validation Results ===");
  console.log(`Patients:      ${result.nPatients}`);
  console.log(`Windows:       ${result.nWindows}`);
  console.log(`ROC-AUC:       ${result.rocAuc.toFixed(3)}`);
  console.log(`PR-AUC:        ${result.prAuc.toFixed(3)}`);
  console.log("");
  console.log("=== CGM Metrics (last 3 days) ===");
  console.log(`Time in Range:  ${result.cgmMetrics.tir.toFixed(1)}%`);
  console.log(`Time Above:     ${result.cgmMetrics.tar.toFixed(1)}%`);
  console.log(`Time Below:     ${result.cgmMetrics.tbr.toFixed(1)}%`);
  console.log(`GMI:            ${result.cgmMetrics.gmi.toFixed(1)}%`);
  console.log(`CV:             ${result.cgmMetrics.cv.toFixed(1)}%`);
  console.log("");
  console.log("=== Sample Predictions ===");
  for (const p of result.samplePredictions) {
    console.log(`  ${p.patientId}: ${(p.probability * 100).toFixed(1)}% (${p.band})`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
