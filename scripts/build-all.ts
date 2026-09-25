// ============================================================================
//  GlucoTwin — master build pipeline.
//  Run with:  bun run scripts/build-all.ts
//
//  Steps:
//   1. Generate 200 synthetic EHR records + 14-day wearables (fixed seed).
//   2. Write data/ehr.csv and data/wearables.csv.
//   3. Build labeled samples (static+dynamic fusion) split BY PATIENT 70/15/15.
//   4. Train logistic-regression baseline + GBDT classifier + GBDT regressor.
//   5. Evaluate on the held-out test patients; compute ROC/PR/F1/confusion/lead-time.
//   6. Save model artifacts to ml/*.json and ml/metrics.json.
//   7. Seed the SQLite DB: EHR, recent 3-day wearables per patient, risk-alert
//      timeline (predictions over the last day per patient), latest-risk snapshot.
// ============================================================================

import { generateEhr, generateWearablesAll, N_PATIENTS } from "@/lib/ml/data-generator";
import { buildPatientSamples, FEATURE_NAMES, computeFeatures } from "@/lib/ml/features";
import { LogisticRegression } from "@/lib/ml/logistic-regression";
import { GBDT } from "@/lib/ml/gbdt";
import { RandomForest } from "@/lib/ml/random-forest";
import {
  confusionMatrix,
  reportMetrics,
  bestThreshold,
  rocCurve,
  prCurve,
} from "@/lib/ml/metrics";
import { fitCalibrator, calibrate, calibrationCurve, expectedCalibrationError } from "@/lib/ml/calibration";
import { computeCgmMetrics } from "@/lib/ml/cgm-metrics";
import { RNG } from "@/lib/ml/rng";
import type { EhrRecord, WearableSample, LabeledSample, MetricsReport } from "@/lib/ml/types";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const ML_DIR = path.join(ROOT, "ml");
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(ML_DIR, { recursive: true });

function log(msg: string) {
  console.log(`[glucotwin] ${msg}`);
}

async function main() {
  const t0 = Date.now();
  log("Step 1: generating synthetic EHR + wearables (fixed seed)...");
  const ehr = generateEhr(N_PATIENTS);
  const wearables = generateWearablesAll(ehr);
  log(`  -> ${ehr.length} patients, ${ehr.length * 14 * 288} wearable samples`);

  log("Step 2: writing CSVs to data/...");
  writeEhrCsv(ehr);
  writeWearablesCsv(ehr, wearables);

  log("Step 3: building labeled samples (patient-wise split)...");
  // Build samples per patient, then sub-sample to a max per patient for tractable training.
  const MAX_PER_PATIENT = 50;
  const allSamples: LabeledSample[] = [];
  for (const e of ehr) {
    const s = buildPatientSamples(wearables.get(e.patientId)!, e, 3);
    // evenly subsample
    const step = Math.max(1, Math.floor(s.length / MAX_PER_PATIENT));
    for (let i = 0; i < s.length; i += step) allSamples.push(s[i]);
  }
  // patient-wise split 70/15/15
  const rng = new RNG(12345);
  const patientIds = rng.shuffle(ehr.map((e) => e.patientId));
  const nTrain = Math.floor(patientIds.length * 0.7);
  const nVal = Math.floor(patientIds.length * 0.15);
  const trainIds = new Set(patientIds.slice(0, nTrain));
  const valIds = new Set(patientIds.slice(nTrain, nTrain + nVal));
  const testIds = new Set(patientIds.slice(nTrain + nVal));

  const train = allSamples.filter((s) => trainIds.has(s.patientId));
  const val = allSamples.filter((s) => valIds.has(s.patientId));
  const test = allSamples.filter((s) => testIds.has(s.patientId));
  log(`  -> ${train.length} train / ${val.length} val / ${test.length} test samples`);
  log(`  -> positive rate: train ${(train.filter((s) => s.label === 1).length / train.length * 100).toFixed(1)}%, test ${(test.filter((s) => s.label === 1).length / test.length * 100).toFixed(1)}%`);

  const Xtr = train.map((s) => s.features);
  const ytr = train.map((s) => s.label);
  const Xval = val.map((s) => s.features);
  const yval = val.map((s) => s.label);
  const Xte = test.map((s) => s.features);
  const yte = test.map((s) => s.label);

  log("Step 4a: training logistic regression baseline...");
  const logreg = new LogisticRegression();
  logreg.fit(Xtr, ytr, { learningRate: 0.15, epochs: 500, l2: 1e-3 });
  const lrValScores = Xval.map((x) => logreg.predictProba(x));
  const lrThreshold = bestThreshold(lrValScores, yval);
  const lrTestScores = Xte.map((x) => logreg.predictProba(x));
  const lrMetrics = reportMetrics("logreg", lrTestScores, yte, lrThreshold);
  log(`  -> logreg ROC-AUC ${lrMetrics.rocAuc.toFixed(3)}, F1 ${lrMetrics.f1.toFixed(3)}`);

  log("Step 4b: training GBDT classifier...");
  const pos = ytr.filter((y) => y === 1).length;
  const neg = ytr.length - pos;
  const clf = new GBDT({ kind: "classification", nTrees: 80, maxDepth: 4, learningRate: 0.1, minChildWeight: 10, l2: 1.0, nBins: 32 });
  clf.fit(Xtr, ytr);
  const clfValScores = Xval.map((x) => clf.predictProba(x));
  const threshold = bestThreshold(clfValScores, yval);
  let clfTestScores = Xte.map((x) => clf.predictProba(x));
  let clfMetrics = reportMetrics("gbdt", clfTestScores, yte, threshold);
  log(`  -> gbdt ROC-AUC ${clfMetrics.rocAuc.toFixed(3)}, PR-AUC ${clfMetrics.prAuc.toFixed(3)}, F1 ${clfMetrics.f1.toFixed(3)}`);

  log("Step 4c: training Random Forest (3-way comparison)...");
  const rf = new RandomForest({ nTrees: 60, maxDepth: 6, minChildWeight: 5, featureSampleFrac: 0.5 });
  rf.fit(Xtr, ytr, 2026);
  const rfValScores = Xval.map((x) => rf.predictProba(x));
  const rfThreshold = bestThreshold(rfValScores, yval);
  const rfTestScores = Xte.map((x) => rf.predictProba(x));
  const rfMetrics = reportMetrics("randomforest", rfTestScores, yte, rfThreshold);
  log(`  -> rf ROC-AUC ${rfMetrics.rocAuc.toFixed(3)}, F1 ${rfMetrics.f1.toFixed(3)}`);

  log("Step 4d: Platt calibration on GBDT (clinical-grade probabilities)...");
  const calibrator = fitCalibrator(clfValScores, yval);
  const clfTestScoresCal = clfTestScores.map((s) => calibrate(s, calibrator));
  const clfMetricsCal = reportMetrics("gbdt-calibrated", clfTestScoresCal, yte, threshold);
  const calCurve = calibrationCurve(clfTestScoresCal, yte, 10);
  const ece = expectedCalibrationError(calCurve);
  log(`  -> calibrated ROC-AUC ${clfMetricsCal.rocAuc.toFixed(3)}, ECE ${ece.toFixed(3)}`);
  // use calibrated scores going forward
  clfTestScores = clfTestScoresCal;
  clfMetrics = clfMetricsCal;

  log("Step 4e: 5-fold patient-wise cross-validation (GBDT)...");
  const foldMetrics: { rocAuc: number; f1: number }[] = [];
  const foldRng = new RNG(99);
  const cvPatientIds = foldRng.shuffle(ehr.map((e) => e.patientId));
  const nFolds = 5;
  const foldSize = Math.floor(cvPatientIds.length / nFolds);
  for (let f = 0; f < nFolds; f++) {
    const valStart = f * foldSize;
    const valEnd = f === nFolds - 1 ? cvPatientIds.length : (f + 1) * foldSize;
    const valFoldIds = new Set(cvPatientIds.slice(valStart, valEnd));
    const trainFold = allSamples.filter((s) => !valFoldIds.has(s.patientId));
    const valFold = allSamples.filter((s) => valFoldIds.has(s.patientId));
    if (trainFold.length === 0 || valFold.length === 0) continue;
    const cvClf = new GBDT({ kind: "classification", nTrees: 60, maxDepth: 4, learningRate: 0.1, minChildWeight: 10, l2: 1.0, nBins: 32 });
    cvClf.fit(trainFold.map((s) => s.features), trainFold.map((s) => s.label));
    const cvScores = valFold.map((s) => cvClf.predictProba(s.features));
    const cvLabels = valFold.map((s) => s.label);
    const cvThresh = bestThreshold(cvScores, cvLabels);
    const cvM = reportMetrics(`fold${f}`, cvScores, cvLabels, cvThresh);
    foldMetrics.push({ rocAuc: cvM.rocAuc, f1: cvM.f1 });
    log(`  -> fold ${f + 1}: ROC-AUC ${cvM.rocAuc.toFixed(3)}, F1 ${cvM.f1.toFixed(3)}`);
  }
  const cvRocAucMean = foldMetrics.reduce((s, m) => s + m.rocAuc, 0) / Math.max(1, foldMetrics.length);
  const cvRocAucStd = Math.sqrt(foldMetrics.reduce((s, m) => s + (m.rocAuc - cvRocAucMean) ** 2, 0) / Math.max(1, foldMetrics.length));
  const cvF1Mean = foldMetrics.reduce((s, m) => s + m.f1, 0) / Math.max(1, foldMetrics.length);
  log(`  -> CV mean ROC-AUC ${cvRocAucMean.toFixed(3)} ± ${cvRocAucStd.toFixed(3)}, F1 ${cvF1Mean.toFixed(3)}`);

  log("Step 4f: training GBDT regressor (glucose @ +120 min)...");
  const ytrT120 = train.map((s) => s.glucoseT120);
  const reg = new GBDT({ kind: "regression", nTrees: 60, maxDepth: 4, learningRate: 0.1, minChildWeight: 10, l2: 1.0, nBins: 32 });
  reg.fit(Xtr, ytrT120);
  const regTestPred = Xte.map((x) => reg.predictRaw(x));
  const yteT120 = test.map((s) => s.glucoseT120);
  const mae120 = regTestPred.reduce((s, p, i) => s + Math.abs(p - yteT120[i]), 0) / yteT120.length;
  const residStd = Math.sqrt(regTestPred.reduce((s, p, i) => s + (p - yteT120[i]) ** 2, 0) / yteT120.length);
  // also +30 / +60 from intermediate sample fields
  const ytrT30 = train.map((s) => s.glucoseT30);
  const reg30 = new GBDT({ kind: "regression", nTrees: 40, maxDepth: 4, learningRate: 0.1 });
  reg30.fit(Xtr, ytrT30);
  const ytrT60 = train.map((s) => s.glucoseT60);
  const reg60 = new GBDT({ kind: "regression", nTrees: 40, maxDepth: 4, learningRate: 0.1 });
  reg60.fit(Xtr, ytrT60);
  const mae30 = Xte.map((x, i) => Math.abs(reg30.predictRaw(x) - test[i].glucoseT30)).reduce((a, b) => a + b, 0) / Xte.length;
  const mae60 = Xte.map((x, i) => Math.abs(reg60.predictRaw(x) - test[i].glucoseT60)).reduce((a, b) => a + b, 0) / Xte.length;
  log(`  -> regression MAE: +30 ${mae30.toFixed(1)}, +60 ${mae60.toFixed(1)}, +120 ${mae120.toFixed(1)} mg/dL`);

  log("Step 5: computing metrics + curves + feature importance...");
  const cm = confusionMatrix(clfTestScores, yte, threshold);
  // Approximate lead time from test windows: a correct alert's lead = distance
  // to the peak within the 120-min horizon (alert fires at t=0).
  let leadCount = 0;
  let leadSum = 0;
  for (let i = 0; i < test.length; i++) {
    if (clfTestScores[i] >= threshold && yte[i] === 1) {
      // peak time within the 120-min window: find argmax of the corresponding future glucose
      // we stored glucoseT30/T60/T120; approximate peak position
      const s = test[i];
      const vals = [s.currentGlucose, s.glucoseT30, s.glucoseT60, s.glucoseT120];
      let peakIdx = 0;
      for (let k = 1; k < vals.length; k++) if (vals[k] > vals[peakIdx]) peakIdx = k;
      const peakTimeMin = peakIdx * 30; // 0,30,60,120
      // alert fires at t=0; lead = 120 - peakTime if peak within window, else 0
      const lead = Math.max(0, 120 - peakTimeMin);
      leadSum += lead;
      leadCount++;
    }
  }
  const leadTimeMin = leadCount > 0 ? leadSum / leadCount : 0;
  log(`  -> lead time (avg, correct alerts): ${leadTimeMin.toFixed(1)} min`);

  const roc = rocCurve(clfTestScores, yte);
  const pr = prCurve(clfTestScores, yte);
  const importance = clf.featureImportance(FEATURE_NAMES);

  const metricsReport: any = {
    logreg: lrMetrics,
    gbdt: clfMetrics,
    randomForest: rfMetrics,
    regression: { maeT30: mae30, maeT60: mae60, maeT120: mae120, residualStd120: residStd },
    threshold,
    confusionMatrix: { tp: cm.tp, fp: cm.fp, fn: cm.fn, tn: cm.tn },
    leadTimeMin,
    rocCurve: roc,
    prCurve: pr,
    featureImportance: importance,
    calibration: {
      ece,
      curve: calCurve,
      plattA: calibrator.a,
      plattB: calibrator.b,
    },
    crossValidation: {
      folds: foldMetrics,
      rocAucMean: cvRocAucMean,
      rocAucStd: cvRocAucStd,
      f1Mean: cvF1Mean,
    },
    generatedAt: new Date().toISOString(),
    nPatients: N_PATIENTS,
    nSamples: allSamples.length,
  };

  log("Step 6: saving model artifacts to ml/...");
  fs.writeFileSync(path.join(ML_DIR, "gbdt-classification.json"), JSON.stringify(clf.toJSON()));
  fs.writeFileSync(path.join(ML_DIR, "gbdt-regression.json"), JSON.stringify(reg.toJSON()));
  fs.writeFileSync(path.join(ML_DIR, "gbdt-regression-30.json"), JSON.stringify(reg30.toJSON()));
  fs.writeFileSync(path.join(ML_DIR, "gbdt-regression-60.json"), JSON.stringify(reg60.toJSON()));
  fs.writeFileSync(path.join(ML_DIR, "logreg.json"), JSON.stringify(logreg.toJSON()));
  fs.writeFileSync(path.join(ML_DIR, "random-forest.json"), JSON.stringify(rf.toJSON()));
  fs.writeFileSync(path.join(ML_DIR, "calibrator.json"), JSON.stringify(calibrator));
  fs.writeFileSync(path.join(ML_DIR, "metrics.json"), JSON.stringify(metricsReport, null, 2));
  fs.writeFileSync(path.join(ML_DIR, "feature-names.json"), JSON.stringify(FEATURE_NAMES));

  log("Step 7: seeding SQLite DB...");
  await seedDb(ehr, wearables, clf, threshold, calibrator);

  log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
  log("Models + metrics in ml/, data CSVs in data/, DB seeded.");
}

// ---- CSV writers ----
function writeEhrCsv(ehr: EhrRecord[]) {
  const cols = [
    "patient_id", "name", "age", "sex", "bmi", "hba1c", "years_since_diagnosis",
    "medication", "hypertension", "family_history_diabetes", "genetic_risk_score",
    "fasting_glucose", "egfr",
  ];
  const lines = [cols.join(",")];
  for (const e of ehr) {
    lines.push(
      [
        e.patientId, `"${e.name}"`, e.age, e.sex, e.bmi, e.hba1c, e.yearsSinceDiagnosis,
        e.medication, e.hypertension, e.familyHistoryDiabetes, e.geneticRiskScore,
        e.fastingGlucose, e.egfr,
      ].join(",")
    );
  }
  fs.writeFileSync(path.join(DATA_DIR, "ehr.csv"), lines.join("\n"));
}

function writeWearablesCsv(ehr: EhrRecord[], wearables: Map<string, WearableSample[]>) {
  const cols = [
    "patient_id", "ts", "ts_human", "glucose", "heart_rate", "hrv_rmssd",
    "steps", "sleep_stage", "meal_carbs_g", "activity_min",
  ];
  const filePath = path.join(DATA_DIR, "wearables.csv");
  fs.writeFileSync(filePath, cols.join(",") + "\n");
  for (const e of ehr) {
    const series = wearables.get(e.patientId)!;
    const buf: string[] = [];
    for (const s of series) {
      buf.push(
        [
          s.patientId, s.ts, s.tsHuman, s.glucose, s.heartRate, s.hrvRmssd,
          s.steps, s.sleepStage, s.mealCarbsG, s.activityMin,
        ].join(",")
      );
    }
    fs.appendFileSync(filePath, buf.join("\n") + "\n");
  }
}

// ---- DB seeding ----
async function seedDb(
  ehr: EhrRecord[],
  wearables: Map<string, WearableSample[]>,
  clf: GBDT,
  threshold: number,
  calibrator: { a: number; b: number }
) {
  const prisma = new PrismaClient();
  try {
    log("  -> wiping existing DB rows...");
    await prisma.riskAlert.deleteMany();
    await prisma.wearableSample.deleteMany();
    await prisma.patient.deleteMany();

    log("  -> inserting EHR patients...");
    for (const e of ehr) {
      await prisma.patient.create({
        data: {
          id: e.patientId,
          name: e.name,
          age: e.age,
          sex: e.sex,
          bmi: e.bmi,
          hba1c: e.hba1c,
          yearsSinceDiagnosis: e.yearsSinceDiagnosis,
          medication: e.medication,
          hypertension: e.hypertension,
          familyHistoryDiabetes: e.familyHistoryDiabetes,
          geneticRiskScore: e.geneticRiskScore,
          fastingGlucose: e.fastingGlucose,
          egfr: e.egfr,
        },
      });
    }

    log("  -> inserting recent 3-day wearables per patient...");
    const RECENT_DAYS = 3;
    const perPatient = RECENT_DAYS * 14 * 288 / 14; // 3*288 = 864
    let totalSamples = 0;
    for (const e of ehr) {
      const series = wearables.get(e.patientId)!;
      const recent = series.slice(Math.max(0, series.length - perPatient));
      // chunked createMany
      for (let i = 0; i < recent.length; i += 1000) {
        const batch = recent.slice(i, i + 1000).map((s) => ({
          patientId: s.patientId,
          ts: s.ts,
          tsHuman: s.tsHuman,
          glucose: s.glucose,
          heartRate: s.heartRate,
          hrvRmssd: s.hrvRmssd,
          steps: s.steps,
          sleepStage: s.sleepStage,
          mealCarbsG: s.mealCarbsG,
          activityMin: s.activityMin,
        }));
        await prisma.wearableSample.createMany({ data: batch });
        totalSamples += batch.length;
      }
    }
    log(`  -> inserted ${totalSamples} wearable samples`);

    log("  -> computing latest-risk snapshot + alert timelines...");
    let alertCount = 0;
    for (const e of ehr) {
      const series = wearables.get(e.patientId)!;
      // latest risk from the last valid window
      const lastIdx = series.length - 1;
      const feats = computeFeatures(series, e, lastIdx);
      let latestRisk = 0;
      let latestGlucose = series[lastIdx].glucose;
      if (feats) latestRisk = calibrate(clf.predictProba(feats), calibrator);
      const band = latestRisk < 0.3 ? "Low" : latestRisk < 0.6 ? "Medium" : "High";
      await prisma.patient.update({
        where: { id: e.patientId },
        data: {
          latestRisk: Math.round(latestRisk * 1000) / 1000,
          latestRiskBand: band,
          latestGlucose: latestGlucose,
        },
      });

      // alert timeline over last 24h (every 30 min)
      const last24hStart = series.length - 24 * 12; // 288 samples/day, 12 per hour -> 24*12=288 last day
      const alerts: any[] = [];
      for (let i = Math.max(72, last24hStart); i < series.length - 1; i += 6) {
        const f = computeFeatures(series, e, i);
        if (!f) continue;
        const proba = calibrate(clf.predictProba(f), calibrator);
        // peak in next 120 min if available
        let peak: number | null = null;
        if (i + 24 < series.length) {
          peak = 0;
          for (let k = i + 1; k <= i + 24; k++) if (series[k].glucose > peak) peak = series[k].glucose;
        }
        alerts.push({
          patientId: e.patientId,
          ts: series[i].ts,
          tsHuman: series[i].tsHuman,
          risk: Math.round(proba * 1000) / 1000,
          triggered: proba >= threshold ? 1 : 0,
          glucoseAtT: series[i].glucose,
          peakGlucose: peak,
        });
        alertCount++;
      }
      if (alerts.length) {
        for (let i = 0; i < alerts.length; i += 500) {
          await prisma.riskAlert.createMany({ data: alerts.slice(i, i + 500) });
        }
      }
    }
    log(`  -> ${alertCount} alert-timeline entries`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
