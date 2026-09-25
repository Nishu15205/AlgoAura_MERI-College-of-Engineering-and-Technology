// Shared types for the GlucoTwin ML pipeline.

/** One synthetic EHR record. */
export interface EhrRecord {
  patientId: string;
  name: string;
  age: number;
  sex: "male" | "female";
  bmi: number;
  hba1c: number;
  yearsSinceDiagnosis: number;
  medication: "none" | "metformin" | "metformin+insulin";
  hypertension: 0 | 1;
  familyHistoryDiabetes: 0 | 1;
  geneticRiskScore: number;
  fastingGlucose: number;
  egfr: number;
}

/** One 5-min wearable sample. */
export interface WearableSample {
  patientId: string;
  ts: number; // unix seconds
  tsHuman: string; // ISO string
  glucose: number; // mg/dL
  heartRate: number; // bpm
  hrvRmssd: number; // ms
  steps: number; // steps in this 5-min bucket
  sleepStage: "awake" | "light" | "deep" | "rem";
  mealCarbsG: number; // carbs of a meal starting at this ts (0 = no meal)
  activityMin: number; // minutes of activity in this 5-min bucket
}

/** A labeled training sample (features + label + regression targets + meta). */
export interface LabeledSample {
  patientId: string;
  ts: number;
  features: number[];
  label: number; // 1 if max glucose in next 120 min > 180
  glucoseT30: number; // glucose at +30 min
  glucoseT60: number; // glucose at +60 min
  glucoseT120: number; // glucose at +120 min
  currentGlucose: number;
}

/** A trained model artifact (serializable to JSON). */
export interface ModelArtifact {
  kind: "classification" | "regression";
  featureNames: string[];
  featureMean: number[];
  featureStd: number[];
  posWeight: number;
  model: any;
  trainPatients: string[];
  valPatients: string[];
  testPatients: string[];
  threshold: number;
}

/** Local explanation: feature -> contribution to this prediction. */
export interface Reason {
  feature: string;
  value: number;
  contribution: number;
  display: string;
}

export interface ModelMetrics {
  name: string;
  rocAuc: number;
  prAuc: number;
  precision: number;
  recall: number;
  f1: number;
  accuracy: number;
  brierScore: number;
}

export interface MetricsReport {
  logreg: ModelMetrics;
  gbdt: ModelMetrics;
  regression: {
    maeT30: number;
    maeT60: number;
    maeT120: number;
    residualStd120: number;
  };
  threshold: number;
  confusionMatrix: { tp: number; fp: number; fn: number; tn: number };
  leadTimeMin: number;
  rocCurve: { fpr: number; tpr: number }[];
  prCurve: { recall: number; precision: number }[];
  featureImportance: { feature: string; importance: number }[];
  generatedAt: string;
  nPatients: number;
  nSamples: number;
}
