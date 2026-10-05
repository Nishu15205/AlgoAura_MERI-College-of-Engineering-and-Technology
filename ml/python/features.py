"""
GlucoTwin — Feature Engineering (Python)
Fuses static EHR + dynamic CGM into 33 features per time window.
Label: 1 if max glucose in next 120 min > 180 mg/dL.

Run: python ml/python/features.py
Output: data/labeled_samples.csv
"""
import numpy as np
import pandas as pd
import os

SPIKE_THRESHOLD = 180
LOOKBACK_MIN = 360  # 6 hours
HORIZON_MIN = 120   # 2 hours
LOOKBACK_STEPS = LOOKBACK_MIN // 5  # 72
HORIZON_STEPS = HORIZON_MIN // 5    # 24

FEATURE_NAMES = [
    "current_glucose","roc_15min","roc_30min","roc_60min",
    "rolling_mean_6h","rolling_std_6h","rolling_min_6h","rolling_max_6h",
    "glucose_range_6h","time_since_last_meal_min","last_meal_carbs",
    "rolling_steps_6h","rolling_hr_mean_6h","rolling_hrv_mean_6h",
    "prev_night_sleep_hours","prev_night_deep_pct","hour_of_day",
    "is_morning","glucose_above_160",
    "age","sex_male","bmi","hba1c","years_since_diagnosis",
    "med_none","med_metformin","med_insulin","hypertension",
    "family_history","genetic_risk_score","fasting_glucose","egfr","insulin_sensitivity"
]

def insulin_sensitivity(row):
    bmi_part = (row["bmi"]-22)/20
    hba1c_part = (row["hba1c"]-6.5)/4.5
    ir = np.clip(0.25*bmi_part + 0.6*hba1c_part + 0.15*row["genetic_risk_score"], 0.05, 0.95)
    return np.clip(1-ir, 0.25, 0.95)

def prev_night_sleep(samples, i):
    start = max(0, i - (12*60)//5)
    sleep_count = 0; deep_count = 0; total = 0
    for k in range(start, i+1):
        total += 1
        if samples["sleep_stage"].iloc[k] != "awake":
            sleep_count += 1
            if samples["sleep_stage"].iloc[k] == "deep": deep_count += 1
    return (sleep_count*5)/60, (deep_count/sleep_count) if sleep_count > 0 else 0

def compute_features(samples, ehr, i):
    if i < LOOKBACK_STEPS or i + HORIZON_STEPS >= len(samples): return None
    window = samples.iloc[i-LOOKBACK_STEPS+1:i+1]
    now = samples.iloc[i]
    cg = now["glucose"]
    s3 = samples.iloc[i-3]["glucose"] if i-3 >= 0 else cg
    s6 = samples.iloc[i-6]["glucose"] if i-6 >= 0 else cg
    s12 = samples.iloc[i-12]["glucose"] if i-12 >= 0 else cg
    gluc = window["glucose"].values
    tsm = 360; lmc = 0
    for k in range(i, max(0, i-LOOKBACK_STEPS)-1, -1):
        if samples["meal_carbs_g"].iloc[k] > 0:
            tsm = (i-k)*5; lmc = samples["meal_carbs_g"].iloc[k]; break
    sh, dp = prev_night_sleep(samples, i)
    hour = pd.Timestamp(now["ts"], unit="s").hour + pd.Timestamp(now["ts"], unit="s").minute/60
    sens = insulin_sensitivity(ehr)
    return [
        cg, cg-s3, cg-s6, cg-s12,
        np.mean(gluc), np.std(gluc), np.min(gluc), np.max(gluc),
        np.max(gluc)-np.min(gluc), tsm, lmc,
        window["steps"].sum(), window["heart_rate"].mean(), window["hrv_rmssd"].mean(),
        sh, dp, hour, 1 if 5<=hour<10 else 0, 1 if cg>160 else 0,
        ehr["age"], 1 if ehr["sex"]=="male" else 0, ehr["bmi"], ehr["hba1c"],
        ehr["years_since_diagnosis"],
        1 if ehr["medication"]=="none" else 0,
        1 if ehr["medication"]=="metformin" else 0,
        1 if ehr["medication"]=="metformin+insulin" else 0,
        ehr["hypertension"], ehr["family_history_diabetes"],
        ehr["genetic_risk_score"], ehr["fasting_glucose"], ehr["egfr"], sens
    ]

def build_samples(ehr_df, wbl_df, stride=6):
    all_samples = []
    for pid in ehr_df["patient_id"].unique():
        ehr = ehr_df[ehr_df["patient_id"]==pid].iloc[0]
        samples = wbl_df[wbl_df["patient_id"]==pid].sort_values("ts").reset_index(drop=True)
        n = len(samples)
        if n < LOOKBACK_STEPS + HORIZON_STEPS + 1: continue
        # Pre-extract numpy arrays for speed
        gluc = samples["glucose"].values
        hr = samples["heart_rate"].values
        hrv = samples["hrv_rmssd"].values
        steps = samples["steps"].values
        meals = samples["meal_carbs_g"].values
        sleep = samples["sleep_stage"].values
        ts_arr = samples["ts"].values
        # Subsample: take every 6th window (stride) + cap at 50 per patient
        valid_indices = list(range(LOOKBACK_STEPS, n - HORIZON_STEPS, stride))
        if len(valid_indices) > 50:
            valid_indices = valid_indices[::max(1, len(valid_indices)//50)][:50]
        for i in valid_indices:
            window_gluc = gluc[i-LOOKBACK_STEPS+1:i+1]
            now_g = gluc[i]
            s3 = gluc[i-3] if i-3 >= 0 else now_g
            s6 = gluc[i-6] if i-6 >= 0 else now_g
            s12 = gluc[i-12] if i-12 >= 0 else now_g
            tsm = 360; lmc = 0
            for k in range(i, max(0, i-LOOKBACK_STEPS)-1, -1):
                if meals[k] > 0:
                    tsm = (i-k)*5; lmc = meals[k]; break
            # prev night sleep
            sl_start = max(0, i - 144)
            sl_count = 0; dl_count = 0
            for k in range(sl_start, i+1):
                if sleep[k] != "awake":
                    sl_count += 1
                    if sleep[k] == "deep": dl_count += 1
            sh = (sl_count * 5) / 60
            dp = dl_count / sl_count if sl_count > 0 else 0
            hour = (ts_arr[i] // 3600 % 24) + ((ts_arr[i] // 60 % 60) / 60)
            sens = insulin_sensitivity(ehr)
            feats = [
                now_g, now_g-s3, now_g-s6, now_g-s12,
                np.mean(window_gluc), np.std(window_gluc),
                np.min(window_gluc), np.max(window_gluc),
                np.max(window_gluc)-np.min(window_gluc), tsm, lmc,
                np.sum(steps[i-LOOKBACK_STEPS+1:i+1]),
                np.mean(hr[i-LOOKBACK_STEPS+1:i+1]),
                np.mean(hrv[i-LOOKBACK_STEPS+1:i+1]),
                sh, dp, hour, 1 if 5<=hour<10 else 0, 1 if now_g>160 else 0,
                ehr["age"], 1 if ehr["sex"]=="male" else 0, ehr["bmi"], ehr["hba1c"],
                ehr["years_since_diagnosis"],
                1 if ehr["medication"]=="none" else 0,
                1 if ehr["medication"]=="metformin" else 0,
                1 if ehr["medication"]=="metformin+insulin" else 0,
                ehr["hypertension"], ehr["family_history_diabetes"],
                ehr["genetic_risk_score"], ehr["fasting_glucose"], ehr["egfr"], sens
            ]
            peak = np.max(gluc[i+1:i+HORIZON_STEPS+1])
            label = 1 if peak > SPIKE_THRESHOLD else 0
            row = {"patient_id": pid, "ts": int(ts_arr[i])}
            row.update(dict(zip(FEATURE_NAMES, feats)))
            row["label"] = label
            row["glucose_t30"] = gluc[i+6]
            row["glucose_t60"] = gluc[i+12]
            row["glucose_t120"] = gluc[i+24]
            row["current_glucose_val"] = now_g
            all_samples.append(row)
    return pd.DataFrame(all_samples)

if __name__ == "__main__":
    print("Loading data...")
    ehr = pd.read_csv("data/ehr.csv")
    wbl = pd.read_csv("data/wearables.csv")
    print(f"  {len(ehr)} patients, {len(wbl)} samples")
    print("Building features...")
    samples = build_samples(ehr, wbl, stride=6)
    samples.to_csv("data/labeled_samples.csv", index=False)
    print(f"  {len(samples)} labeled samples → data/labeled_samples.csv")
    print(f"  Positive rate: {samples['label'].mean()*100:.1f}%")
