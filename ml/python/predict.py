"""
GlucoTwin — Prediction + SHAP Explanation (Python)
Loads trained models and predicts spike risk + SHAP reasons for a patient.

Run: python ml/python/predict.py <patient_id>
"""
import sys
import json
import joblib
import numpy as np
import pandas as pd

def predict(patient_id="P0001"):
    # Load data
    ehr = pd.read_csv("data/ehr.csv")
    wbl = pd.read_csv("data/wearables.csv")
    patient_ehr = ehr[ehr["patient_id"] == patient_id].iloc[0]
    patient_wbl = wbl[wbl["patient_id"] == patient_id].sort_values("ts").reset_index(drop=True)

    # Load models
    model = joblib.load("ml/python/models/gbdt_calibrated.joblib")
    raw_model = joblib.load("ml/python/models/gbdt_raw.joblib")
    metrics = json.load(open("ml/python/metrics.json"))
    feature_names = metrics["feature_names"]

    # Compute features for latest window
    from features import compute_features, LOOKBACK_STEPS
    i = len(patient_wbl) - 1
    feats = compute_features(patient_wbl, patient_ehr, i)
    if feats is None:
        print("Not enough history"); return

    X = np.array(feats).reshape(1, -1)
    proba = model.predict_proba(X)[0, 1]
    band = "Low" if proba < 0.3 else ("Medium" if proba < 0.6 else "High")

    print(f"\n{'='*50}")
    print(f"Patient: {patient_id} ({patient_ehr['name']})")
    print(f"Current glucose: {feats[0]:.0f} mg/dL")
    print(f"Spike risk: {proba*100:.1f}% ({band})")
    print(f"Threshold: {metrics['threshold']}")
    print(f"{'='*50}")

    # SHAP explanations
    try:
        import shap
        explainer = joblib.load("ml/python/models/shap_explainer.joblib")
        shap_values = explainer.shap_values(X)[0]
        # Top 6 reasons
        idx = np.argsort(np.abs(shap_values))[::-1][:6]
        print(f"\nTop SHAP reasons:")
        for rank, j in enumerate(idx):
            direction = "raises" if shap_values[j] > 0 else "lowers"
            print(f"  {rank+1}. {feature_names[j]} = {feats[j]:.1f} → {direction} risk (SHAP={shap_values[j]:.3f})")
    except Exception as e:
        print(f"SHAP not available: {e}")

    return {"patient_id": patient_id, "probability": proba, "band": band}

if __name__ == "__main__":
    pid = sys.argv[1] if len(sys.argv) > 1 else "P0001"
    predict(pid)
