"""
GlucoTwin — Data Generation (Python)
Generates 200 synthetic patients with correlated EHR + 14-day wearable data.
Fixed seed for reproducibility. Same physiological model as the TS version.

Run: python ml/python/generate_data.py
Output: data/ehr.csv, data/wearables.csv
"""
import numpy as np
import pandas as pd
import os

SEED = 20260117
np.random.seed(SEED)

N_PATIENTS = 200
N_DAYS = 14
INTERVAL_MIN = 5
SAMPLES_PER_DAY = (24 * 60) // INTERVAL_MIN  # 288
START_TS = int(pd.Timestamp("2026-01-01").timestamp())

FIRST_NAMES_M = ["Aarav","Vivaan","Aditya","Vihaan","Arjun","Sai","Reyansh","Krishna",
    "Ishaan","Rohan","Rahul","Amit","Sanjay","Vikram","Karan","Nikhil",
    "Manoj","Rajesh","Anil","Suresh","Deepak","Rakesh","Vivek","Akash"]
FIRST_NAMES_F = ["Aanya","Diya","Saanvi","Aadhya","Aaradhya","Ananya","Priya","Pooja",
    "Neha","Kavya","Meera","Riya","Ira","Myra","Tanvi","Shreya",
    "Deepa","Lata","Geeta","Sunita","Anjali","Pallavi","Sneha","Madhuri"]
LAST_NAMES = ["Sharma","Verma","Patel","Gupta","Reddy","Nair","Iyer","Menon",
    "Kapoor","Malhotra","Chopra","Mehta","Joshi","Desai","Rao","Pillai",
    "Banerjee","Mukherjee","Das","Sen","Khan","Sheikh","Ali","Singh"]

def generate_ehr(n=N_PATIENTS):
    records = []
    used_names = set()
    for i in range(n):
        pid = f"P{i+1:04d}"
        sex = np.random.choice(["male","female"], p=[0.52,0.48])
        pool = FIRST_NAMES_M if sex == "male" else FIRST_NAMES_F
        while True:
            name = f"{np.random.choice(pool)} {np.random.choice(LAST_NAMES)}"
            if name not in used_names:
                used_names.add(name); break
        age = np.random.randint(30, 76)
        bmi_shift = 0.6 if sex == "male" else -0.4
        bmi = np.clip(np.random.normal(30 + bmi_shift, 4.2), 22, 42)
        hba1c = np.clip(6.5 + ((bmi-22)/20)*1.6 + np.random.normal(0, 0.55), 6.5, 11)
        yrs = round(np.clip((age-30)/45*18 + (hba1c-6.5)*1.2 + np.random.normal(0,2), 0, 25))
        if hba1c < 7.3:
            med = np.random.choice(["none","metformin"], p=[0.55,0.45])
        elif hba1c < 8.8:
            med = np.random.choice(["metformin","metformin+insulin"], p=[0.7,0.3])
        else:
            med = np.random.choice(["metformin+insulin","metformin"], p=[0.8,0.2])
        htn = 1 if np.random.random() < np.clip(0.12 + (age-30)/45*0.5 + (bmi-22)/20*0.25, 0.05, 0.9) else 0
        fam = 1 if np.random.random() < 0.55 else 0
        gen_risk = np.clip(np.random.normal(0.62 if fam else 0.38, 0.14), 0, 1)
        fasting = np.clip(28.7*hba1c - 46.7 + np.random.normal(0,8), 90, 220)
        egfr_shift = 3 if sex == "male" else -3
        egfr = np.clip(120 - 0.75*age - (hba1c-6.5)*2.5 + egfr_shift + np.random.normal(0,6), 30, 120)
        records.append({
            "patient_id": pid, "name": name, "age": age, "sex": sex,
            "bmi": round(bmi,1), "hba1c": round(hba1c,1), "years_since_diagnosis": yrs,
            "medication": med, "hypertension": htn, "family_history_diabetes": fam,
            "genetic_risk_score": round(gen_risk,3), "fasting_glucose": round(fasting),
            "egfr": round(egfr)
        })
    return pd.DataFrame(records)

def insulin_profile(row):
    bmi_part = (row["bmi"]-22)/20
    hba1c_part = (row["hba1c"]-6.5)/4.5
    ir = np.clip(0.25*bmi_part + 0.6*hba1c_part + 0.15*row["genetic_risk_score"], 0.05, 0.95)
    sens = np.clip(1-ir, 0.25, 0.95)
    boost = 0; red = 0
    if row["medication"] == "metformin": boost, red = 0.18, 0.15
    elif row["medication"] == "metformin+insulin": boost, red = 0.4, 0.32
    return sens, boost, red

def generate_wearables(ehr_df):
    all_rows = []
    for _, e in ehr_df.iterrows():
        sens, boost, red = insulin_profile(e)
        glucose = e["fasting_glucose"]
        gut = 0; day_base = e["fasting_glucose"]
        for d in range(N_DAYS):
            sleep_h = np.clip(np.random.normal(6.6, 1.1), 3.5, 9)
            sleep_q = np.clip((sleep_h-5)/4 + (np.random.normal(0.18,0.05)-0.1)/0.2, 0, 2)/2
            sleep_pen = (1-sleep_q)*12
            day_base = e["fasting_glucose"] + sleep_pen
            # meals
            meals = [(np.random.randint(7*60,9*60), np.random.randint(35,70)),
                     (np.random.randint(12*60,13*60+30), np.random.randint(50,90)),
                     (np.random.randint(19*60,21*60), np.random.randint(55,100))]
            if np.random.random() < 0.5:
                meals.append((np.random.randint(16*60,17*60), np.random.randint(15,40)))
            walks = []
            n_walks = 1 if np.random.random() < 0.7 else (2 if np.random.random() < 0.5 else 0)
            for _ in range(n_walks):
                walks.append((np.random.randint(8*60,20*60), np.random.randint(20,55)))
            for s in range(SAMPLES_PER_DAY):
                mod = s * INTERVAL_MIN
                hr = mod / 60
                ts = START_TS + (d*SAMPLES_PER_DAY + s) * INTERVAL_MIN * 60
                # sleep stage
                stage = "awake"
                if hr >= 23 or hr < 7:
                    cyc = int((mod % 480) // 90)
                    stage = ["deep","light","rem","light"][cyc % 4]
                elif 13 <= hr < 13.5 and np.random.random() < 0.3:
                    stage = "light"
                awake = stage == "awake"
                # glucose model
                abs_rate = 0.07
                absorbed = gut * abs_rate
                gut = max(0, gut - absorbed)
                carb_to_g = (1.7*(1-red))/sens
                d_gut = absorbed * carb_to_g
                for m_time, m_carbs in meals:
                    if m_time == mod: gut += m_carbs
                clearance = (0.05+boost)*sens
                d_clear = (glucose - day_base) * clearance
                d_dawn = 0
                if 4 <= hr < 8: d_dawn = (e["hba1c"]-6.5)*0.6*(1-abs(hr-6)/2)
                act_min = 0; steps = 0
                for w_start, w_dur in walks:
                    if w_start <= mod < w_start+w_dur:
                        act_min = min(5, w_dur-(mod-w_start)); steps = np.random.randint(60,120)
                d_ex = -act_min*(0.35+0.2*(1-sens))
                # HR
                bpm = 72
                if not awake: bpm = 58 + int((hr%2)*2)
                if act_min > 0: bpm = 95 + np.random.randint(0,25)
                elif gut > 0: bpm += 6
                bpm += int(np.random.normal(0,3)); bpm = max(45, min(170, bpm))
                # HRV
                hrv = 42
                if not awake: hrv += 18
                if act_min > 0: hrv -= 10
                hrv -= max(0, (glucose-120)*0.08); hrv -= sleep_pen*0.6
                hrv += np.random.normal(0,4); hrv = max(12, min(110, hrv))
                # integrate
                glucose = glucose + d_gut - d_clear + d_dawn + d_ex + np.random.normal(0,2.5)
                glucose = max(40, min(400, glucose))
                meal_carbs = 0
                for m_time, m_carbs in meals:
                    if m_time == mod: meal_carbs = m_carbs
                if act_min == 0 and awake:
                    steps = np.random.randint(2,40) if np.random.random() < 0.35 else 0
                all_rows.append({
                    "patient_id": e["patient_id"], "ts": ts,
                    "ts_human": pd.Timestamp(ts, unit="s").isoformat(),
                    "glucose": round(glucose,1), "heart_rate": bpm,
                    "hrv_rmssd": round(hrv,1), "steps": steps,
                    "sleep_stage": stage, "meal_carbs_g": meal_carbs,
                    "activity_min": act_min
                })
    return pd.DataFrame(all_rows)

if __name__ == "__main__":
    os.makedirs("data", exist_ok=True)
    print("Generating EHR...")
    ehr = generate_ehr()
    ehr.to_csv("data/ehr.csv", index=False)
    print(f"  {len(ehr)} patients → data/ehr.csv")
    print("Generating wearables...")
    wbl = generate_wearables(ehr)
    wbl.to_csv("data/wearables.csv", index=False)
    print(f"  {len(wbl)} samples → data/wearables.csv")
    print("Done.")
