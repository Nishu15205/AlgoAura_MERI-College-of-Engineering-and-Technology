// Shared frontend types mirroring the API responses.

export type RiskBand = "Low" | "Medium" | "High";

export interface PatientSummary {
  id: string;
  name: string;
  age: number;
  sex: string;
  bmi: number;
  hba1c: number;
  medication: string;
  latestRisk: number;
  latestRiskBand: RiskBand;
  latestGlucose: number;
}

export interface EhrPatient extends PatientSummary {
  yearsSinceDiagnosis: number;
  hypertension: number;
  familyHistoryDiabetes: number;
  geneticRiskScore: number;
  fastingGlucose: number;
  egfr: number;
  updatedAt?: string;
}

export interface WearablePoint {
  ts: number;
  tsHuman: string;
  glucose: number;
  heartRate: number;
  hrvRmssd: number;
  steps: number;
  sleepStage: "awake" | "light" | "deep" | "rem";
  mealCarbsG: number;
  activityMin: number;
}

export interface Reason {
  feature: string;
  value: number;
  contribution: number;
  display: string;
}

export interface GlucoseCurvePoint {
  t: number;
  glucose: number;
  lower: number;
  upper: number;
}

export interface RiskPrediction {
  patientId: string;
  currentGlucose: number;
  timestamp: string;
  probability: number;
  band: RiskBand;
  threshold: number;
  reasons: Reason[];
  glucoseCurve: GlucoseCurvePoint[];
  predictedPeak: number;
  modelVersion: string;
}

export interface WhatIfResult {
  patientId: string;
  action: {
    carbsG: number;
    walkMinutes: number;
    sleepHours: number;
    skipMedication: boolean;
  };
  baseline: { t: number; glucose: number }[];
  whatIf: { t: number; glucose: number }[];
  baselinePeak: number;
  whatIfPeak: number;
  baselineRiskBand: RiskBand;
  whatIfRiskBand: RiskBand;
  baselineSpikeProb: number;
  whatIfSpikeProb: number;
  deltaRisk: number;
  summary: string;
}

export interface ModelMetricsData {
  logreg: {
    name: string;
    rocAuc: number;
    prAuc: number;
    precision: number;
    recall: number;
    f1: number;
    accuracy: number;
    brierScore: number;
  };
  gbdt: {
    name: string;
    rocAuc: number;
    prAuc: number;
    precision: number;
    recall: number;
    f1: number;
    accuracy: number;
    brierScore: number;
  };
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
