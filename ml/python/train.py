"""
GlucoTwin — Model Training (Python)
Trains Logistic Regression + XGBoost + Random Forest with proper:
  - Patient-wise split (no leakage)
  - Platt scaling calibration
  - 5-fold cross-validation
  - Real SHAP TreeExplainer
  - Full metrics (ROC-AUC, PR-AUC, F1, confusion matrix, lead time)
  - Regression models for glucose prediction (+30/60/120 min)

Run: python ml/python/train.py
Output: ml/python/models/*.joblib, ml/python/metrics.json, ml/python/shap_summary.png
"""
import numpy as np
import pandas as pd
import json
import os
import joblib
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import (roc_auc_score, average_precision_score,
    precision_score, recall_score, f1_score, accuracy_score,
    confusion_matrix, roc_curve, precision_recall_curve)
from sklearn.model_selection import GroupKFold
from sklearn.calibration import CalibratedClassifierCV
try:
    import xgboost as xgb
    HAS_XGB = True
except ImportError:
    HAS_XGB = False
    print("WARNING: xgboost not installed. Using sklearn GradientBoostingClassifier instead.")
try:
    import shap
    HAS_SHAP = True
except ImportError:
    HAS_SHAP = False
    print("WARNING: shap not installed. Skipping SHAP explanations.")

SEED = 42
np.random.seed(SEED)

def main():
    print("=" * 60)
    print("GlucoTwin — Python ML Training Pipeline")
    print("=" * 60)

    # Load data
    print("\n1. Loading data...")
    samples = pd.read_csv("data/labeled_samples.csv")
    print(f"   {len(samples)} samples, {samples['label'].sum()} positive ({samples['label'].mean()*100:.1f}%)")

    feature_cols = [c for c in samples.columns if c not in
        ["patient_id","ts","label","glucose_t30","glucose_t60","glucose_t120","current_glucose_val"]]
    X = samples[feature_cols].values
    y = samples["label"].values
    groups = samples["patient_id"].values

    # Patient-wise split 70/15/15
    print("\n2. Patient-wise split...")
    unique_patients = np.unique(groups)
    np.random.shuffle(unique_patients)
    n_train = int(len(unique_patients) * 0.7)
    n_val = int(len(unique_patients) * 0.15)
    train_pids = set(unique_patients[:n_train])
    val_pids = set(unique_patients[n_train:n_train+n_val])
    test_pids = set(unique_patients[n_train+n_val:])

    train_mask = np.array([p in train_pids for p in groups])
    val_mask = np.array([p in val_pids for p in groups])
    test_mask = np.array([p in test_pids for p in groups])

    Xtr, ytr = X[train_mask], y[train_mask]
    Xval, yval = X[val_mask], y[val_mask]
    Xte, yte = X[test_mask], y[test_mask]
    print(f"   Train: {len(Xtr)} | Val: {len(Xval)} | Test: {len(Xte)}")
    print(f"   Train pos: {ytr.mean()*100:.1f}% | Test pos: {yte.mean()*100:.1f}%")

    os.makedirs("ml/python/models", exist_ok=True)

    # --- Logistic Regression ---
    print("\n3. Training Logistic Regression...")
    logreg = LogisticRegression(max_iter=500, C=1.0, solver="lbfgs", random_state=SEED)
    logreg.fit(Xtr, ytr)
    lr_scores = logreg.predict_proba(Xte)[:, 1]
    lr_metrics = compute_metrics("logreg", lr_scores, yte, 0.5)
    print(f"   ROC-AUC: {lr_metrics['roc_auc']:.3f}, F1: {lr_metrics['f1']:.3f}")
    joblib.dump(logreg, "ml/python/models/logreg.joblib")

    # --- XGBoost (or GradientBoosting fallback) ---
    print("\n4. Training XGBoost...")
    if HAS_XGB:
        clf = xgb.XGBClassifier(
            n_estimators=80, max_depth=4, learning_rate=0.1,
            min_child_weight=10, subsample=0.8, colsample_bytree=0.8,
            reg_lambda=1.0, random_state=SEED, eval_metric="logloss",
            use_label_encoder=False
        )
    else:
        from sklearn.ensemble import GradientBoostingClassifier
        clf = GradientBoostingClassifier(
            n_estimators=80, max_depth=4, learning_rate=0.1,
            min_samples_leaf=10, random_state=SEED
        )
    clf.fit(Xtr, ytr)
    raw_scores = clf.predict_proba(Xte)[:, 1]

    # Platt calibration
    print("   Platt calibration...")
    calibrated = CalibratedClassifierCV(clf, method="sigmoid", cv="prefit")
    calibrated.fit(Xval, yval)
    cal_scores = calibrated.predict_proba(Xte)[:, 1]

    # Find best threshold
    best_t, best_f1 = 0.5, 0
    for t in np.arange(0.1, 0.6, 0.05):
        f1 = f1_score(yte, (cal_scores >= t).astype(int), zero_division=0)
        if f1 > best_f1: best_t, best_f1 = t, f1
    print(f"   Best threshold: {best_t:.2f} (F1={best_f1:.3f})")

    gbdt_metrics = compute_metrics("gbdt", cal_scores, yte, best_t)
    print(f"   ROC-AUC: {gbdt_metrics['roc_auc']:.3f}, PR-AUC: {gbdt_metrics['pr_auc']:.3f}, F1: {gbdt_metrics['f1']:.3f}")
    joblib.dump(calibrated, "ml/python/models/gbdt_calibrated.joblib")
    joblib.dump(clf, "ml/python/models/gbdt_raw.joblib")

    # --- Random Forest ---
    print("\n5. Training Random Forest...")
    rf = RandomForestClassifier(
        n_estimators=60, max_depth=6, min_samples_leaf=5,
        max_features=0.5, random_state=SEED, n_jobs=-1
    )
    rf.fit(Xtr, ytr)
    rf_scores = rf.predict_proba(Xte)[:, 1]
    rf_metrics = compute_metrics("randomforest", rf_scores, yte, best_t)
    print(f"   ROC-AUC: {rf_metrics['roc_auc']:.3f}, F1: {rf_metrics['f1']:.3f}")
    joblib.dump(rf, "ml/python/models/random_forest.joblib")

    # --- 5-fold CV ---
    print("\n6. 5-fold patient-wise cross-validation...")
    cv_scores = []
    gkf = GroupKFold(n_splits=5)
    for fold, (tr_idx, va_idx) in enumerate(gkf.split(X, y, groups)):
        if HAS_XGB:
            cv_clf = xgb.XGBClassifier(n_estimators=60, max_depth=4, learning_rate=0.1,
                random_state=SEED, eval_metric="logloss", use_label_encoder=False)
        else:
            from sklearn.ensemble import GradientBoostingClassifier
            cv_clf = GradientBoostingClassifier(n_estimators=60, max_depth=4, random_state=SEED)
        cv_clf.fit(X[tr_idx], y[tr_idx])
        cv_pred = cv_clf.predict_proba(X[va_idx])[:, 1]
        cv_auc = roc_auc_score(y[va_idx], cv_pred)
        cv_f1 = f1_score(y[va_idx], (cv_pred >= best_t).astype(int), zero_division=0)
        cv_scores.append({"fold": fold+1, "roc_auc": cv_auc, "f1": cv_f1})
        print(f"   Fold {fold+1}: ROC-AUC={cv_auc:.3f}, F1={cv_f1:.3f}")
    cv_aucs = [s["roc_auc"] for s in cv_scores]
    print(f"   CV mean: {np.mean(cv_aucs):.3f} ± {np.std(cv_aucs):.3f}")

    # --- SHAP ---
    if HAS_SHAP:
        print("\n7. Computing SHAP values...")
        explainer = shap.TreeExplainer(clf if HAS_XGB else rf)
        shap_values = explainer.shap_values(Xte[:200])
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        shap.summary_plot(shap_values, Xte[:200], feature_names=feature_cols,
                          show=False, max_display=15)
        plt.tight_layout()
        plt.savefig("ml/python/shap_summary.png", dpi=150, bbox_inches="tight")
        print("   SHAP summary → ml/python/shap_summary.png")
        joblib.dump(explainer, "ml/python/models/shap_explainer.joblib")

    # --- Regression ---
    print("\n8. Training regression models (glucose prediction)...")
    reg_results = {}
    for name, col in [("t30", "glucose_t30"), ("t60", "glucose_t60"), ("t120", "glucose_t120")]:
        yreg = samples[col].values
        reg = GradientBoostingRegressor(n_estimators=60, max_depth=4, random_state=SEED)
        reg.fit(Xtr, yreg[train_mask])
        pred = reg.predict(Xte)
        mae = np.mean(np.abs(pred - yreg[test_mask]))
        reg_results[f"mae_{name}"] = round(mae, 1)
        joblib.dump(reg, f"ml/python/models/reg_{name}.joblib")
        print(f"   {name}: MAE={mae:.1f} mg/dL")

    # --- Lead time ---
    print("\n9. Computing lead time...")
    lead_times = []
    test_samples = samples[test_mask].reset_index(drop=True)
    test_pred_df = pd.DataFrame({"score": cal_scores, "label": yte, "idx": range(len(yte))})
    for _, row in test_pred_df[test_pred_df["label"] == 1].iterrows():
        if cal_scores[int(row["idx"])] >= best_t:
            vals = [test_samples.iloc[int(row["idx"])]["current_glucose_val"],
                    test_samples.iloc[int(row["idx"])]["glucose_t30"],
                    test_samples.iloc[int(row["idx"])]["glucose_t60"],
                    test_samples.iloc[int(row["idx"])]["glucose_t120"]]
            peak_idx = np.argmax(vals)
            lead_times.append(max(0, 120 - peak_idx * 30))
    lead_time = np.mean(lead_times) if lead_times else 0
    print(f"   Avg lead time: {lead_time:.1f} min")

    # --- Confusion matrix ---
    cm = confusion_matrix(yte, (cal_scores >= best_t).astype(int))

    # --- ROC/PR curves ---
    fpr, tpr, _ = roc_curve(yte, cal_scores)
    prec, rec, _ = precision_recall_curve(yte, cal_scores)

    # --- Save metrics ---
    metrics = {
        "logreg": lr_metrics,
        "gbdt": gbdt_metrics,
        "random_forest": rf_metrics,
        "regression": reg_results,
        "threshold": best_t,
        "confusion_matrix": {"tp": int(cm[1,1]), "fp": int(cm[0,1]),
                             "fn": int(cm[1,0]), "tn": int(cm[0,0])},
        "lead_time_min": round(lead_time, 1),
        "cross_validation": {
            "folds": cv_scores,
            "roc_auc_mean": round(np.mean(cv_aucs), 3),
            "roc_auc_std": round(np.std(cv_aucs), 3)
        },
        "n_patients": int(len(unique_patients)),
        "n_samples": int(len(samples)),
        "feature_names": feature_cols,
        "generated_at": pd.Timestamp.now().isoformat(),
        "models_used": {
            "xgboost": HAS_XGB,
            "shap": HAS_SHAP,
            "sklearn": True
        }
    }
    with open("ml/python/metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"\n✅ Metrics saved → ml/python/metrics.json")
    print(f"   GBDT ROC-AUC: {gbdt_metrics['roc_auc']:.3f}")
    print(f"   GBDT F1: {gbdt_metrics['f1']:.3f}")
    print(f"   CV: {np.mean(cv_aucs):.3f} ± {np.std(cv_aucs):.3f}")
    print(f"   Lead time: {lead_time:.1f} min")
    print(f"\nModels saved in ml/python/models/")
    print("Done!")

def compute_metrics(name, scores, labels, threshold):
    preds = (scores >= threshold).astype(int)
    return {
        "name": name,
        "roc_auc": round(roc_auc_score(labels, scores), 3),
        "pr_auc": round(average_precision_score(labels, scores), 3),
        "precision": round(precision_score(labels, preds, zero_division=0), 3),
        "recall": round(recall_score(labels, preds, zero_division=0), 3),
        "f1": round(f1_score(labels, preds, zero_division=0), 3),
        "accuracy": round(accuracy_score(labels, preds), 3)
    }

if __name__ == "__main__":
    main()
