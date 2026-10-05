"""
GlucoTwin — External Validation on MIMIC-IV / OhioT1DM (Python)
Loads real anonymized CGM data and runs the trained model.

Usage:
  python ml/python/validate_external.py <path-to-cgm.csv>

Expected CSV columns: patient_id, ts (ISO), glucose (mg/dL), heart_rate, hrv, steps, sleep_stage
"""
import sys
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score, average_precision_score, f1_score

def validate(csv_path):
    print(f"Loading external data from {csv_path}...")
    df = pd.read_csv(csv_path)

    # Load models
    model = joblib.load("ml/python/models/gbdt_calibrated.joblib")
    metrics = json.load(open("ml/python/metrics.json"))
    feature_names = metrics["feature_names"]
    threshold = metrics["threshold"]

    # Default EHR (fill if external data doesn't have it)
    default_ehr = {
        "age": 55, "sex": "male", "bmi": 30, "hba1c": 7.5,
        "years_since_diagnosis": 5, "medication": "metformin",
        "hypertension": 1, "family_history_diabetes": 1,
        "genetic_risk_score": 0.5, "fasting_glucose": 140, "egfr": 90
    }

    all_scores = []
    all_labels = []
    all_glucose = []

    for pid in df["patient_id"].unique():
        patient = df[df["patient_id"] == pid].sort_values("ts").reset_index(drop=True)
        if len(patient) < 73: continue

        ehr = pd.Series(default_ehr)
        ehr["patient_id"] = pid

        from features import compute_features, LOOKBACK_STEPS, HORIZON_STEPS
        for i in range(LOOKBACK_STEPS, len(patient) - HORIZON_STEPS, 6):
            feats = compute_features(patient, ehr, i)
            if feats is None: continue
            X = np.array(feats).reshape(1, -1)
            score = model.predict_proba(X)[0, 1]
            peak = patient.iloc[i+1:i+HORIZON_STEPS+1]["glucose"].max()
            label = 1 if peak > 180 else 0
            all_scores.append(score)
            all_labels.append(label)
            all_glucose.extend(patient["glucose"].values)

    if not all_labels:
        print("Not enough data for validation"); return

    scores = np.array(all_scores)
    labels = np.array(all_labels)

    print(f"\n{'='*50}")
    print(f"External Validation Results")
    print(f"{'='*50}")
    print(f"Patients: {df['patient_id'].nunique()}")
    print(f"Windows: {len(labels)}")
    print(f"ROC-AUC: {roc_auc_score(labels, scores):.3f}")
    print(f"PR-AUC: {average_precision_score(labels, scores):.3f}")
    print(f"F1: {f1_score(labels, (scores >= threshold).astype(int), zero_division=0):.3f}")
    print(f"Positive rate: {labels.mean()*100:.1f}%")
    # CGM metrics
    g = np.array(all_glucose)
    tir = np.mean((g >= 70) & (g <= 180)) * 100
    tar = np.mean(g > 180) * 100
    tbr = np.mean(g < 70) * 100
    gmi = 3.31 + 0.02392 * g.mean()
    print(f"\nCGM Metrics:")
    print(f"  TIR: {tir:.1f}%")
    print(f"  TAR: {tar:.1f}%")
    print(f"  TBR: {tbr:.1f}%")
    print(f"  GMI: {gmi:.1f}%")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ml/python/validate_external.py <path-to-cgm.csv>")
        sys.exit(1)
    validate(sys.argv[1])
