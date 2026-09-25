# GlucoTwin — 3-Minute Demo Script

Total runtime: 3:00. Target audience: Happiest Health "Digital Twin Challenge 2026" judges (clinicians + engineers). Tone: confident, honest, clinical. The disclaimer banner ("Research prototype, synthetic data, not medical advice") is visible on screen throughout.

**Speaker:** `[Member 1]` (narrator). On-screen driver: `[Member 2]`.

---

## 0:00 — 0:20 | Intro & the problem

**Speaker (on camera):**
> India has 101 million people living with diabetes — the most of any country in the world. Today, care is reactive: a patient sees a clinician every few months, an HbA1c is measured, and the dose is adjusted long after the damage is done. GlucoTwin is a digital twin that predicts glucose spikes *before* they happen, explains *why*, and lets a clinician rehearse *what to do*.

**On-screen action:**
- Title card: "GlucoTwin — A Type 2 Diabetes Digital Twin". Team name `[TeamName]`, college `[CollegeName]`.
- Cut to a wide shot of the dashboard at `http://localhost:3000`, disclaimer banner visible.

---

## 0:20 — 0:45 | The patient list & risk triage

**Speaker:**
> This is the clinician dashboard. We start on the Patient List — 200 synthetic patients, each with a latest-risk snapshot computed by the twin. Patients are sorted by risk so the doctor triages the highest-risk first. Let's pick the top patient.

**On-screen action:**
- Patient List view. Sort by latest risk descending. The top row is highlighted in red (High band).
- Click the top patient to open the Digital Twin View.

---

## 0:45 — 1:30 | The Digital Twin View — prediction + explanation

**Speaker:**
> This is the Digital Twin View for our highest-risk patient. On the left, the last 24 hours of CGM, heart rate, HRV, steps, and sleep — streaming in live over an SSE feed, just like a real wearable. On the right, the twin's forecast: there is a 78% probability that glucose will spike above 180 mg/dL in the next 120 minutes, with an average lead time of 84 minutes on correct alerts across the held-out test set.

**Speaker:**
> The twin doesn't just give a number — it explains it. These six reasons are computed by a tree-interpreter in log-odds space, the same idea as SHAP's TreeExplainer. The top reasons here: current glucose is 172, the 30-minute trend is rising, sleep was poor last night, and HbA1c is 8.4. Each reason is anchored in a real feature the model used.

**On-screen action:**
- Digital Twin View: live CGM chart updating via SSE; predicted 120-min glucose curve with 95% confidence band; spike probability gauge at 78%; risk band "High"; the six reason cards listed one by one as the speaker names them.

---

## 1:30 — 2:15 | The What-if Simulator

**Speaker:**
> Now the clinician asks: what can the patient do right now? We open the What-if Simulator. The twin runs a physiological model — the same one that generated the training data — so the simulation is consistent with what the model learned. Let's try two scenarios.

**Speaker:**
> Scenario one: the patient eats a 60-gram carb meal right now. The simulated curve peaks at 198 mg/dL and the spike risk climbs to 84%. Scenario two: the same meal, but the patient takes a 25-minute walk. The walk cancels most of the meal — peak drops to 178, risk falls back to 61%. The clinician can see, in seconds, that a short walk is enough to avoid the spike.

**On-screen action:**
- What-if Simulator view. Slider for meal carbs set to 60g. Baseline (grey) vs what-if (teal) curves overlay. Peak and risk delta update live.
- Then walk-minutes slider set to 25. The teal curve visibly flattens; the risk delta turns green (negative).

---

## 2:15 — 2:45 | Model Insights & honesty

**Speaker:**
> The Model Insights view shows how the twin was validated. We split 200 patients 70/15/15 by patient — no row leakage — and report on the held-out 30 test patients. ROC-AUC 0.96, PR-AUC 0.49, F1 0.87, Brier 0.065. The regression siblings predict glucose at +30, +60, and +120 minutes with MAE of 5.0, 6.5, and 8.7 mg/dL. The confusion matrix and the lead-time number are right here.

**Speaker:**
> One honest caveat, visible everywhere in the app: this is a research prototype on synthetic data. The metrics describe how well the model learned our data generator, not how it would perform on real patients. It is not a medical device and must not be used for clinical decisions.

**On-screen action:**
- Model Insights view: ROC curve, PR curve, confusion matrix (TP 451 / FP 35 / FN 95 / TN 949), regression MAE table, lead-time "84.1 min", feature-importance bar chart (current_glucose and fasting_glucose on top).
- Cut to the disclaimer banner, held for 2 seconds.

---

## 2:45 — 3:00 | Close

**Speaker:**
> GlucoTwin is a Type-2 diabetes digital twin: synthetic data, real trained models, explainable predictions, a physiological what-if simulator, and a clinician dashboard — all in one Next.js app. The next step is a real-data, IRB-approved study. Thank you. Team `[TeamName]`, `[CollegeName]`.

**On-screen action:**
- Closing card: team name, college, GitHub link, license (MIT). Disclaimer repeated.

---

## Production notes

- **Capture:** record at 1920×1080, 30 fps, in the browser with the dashboard running locally on `http://localhost:3000` after `bun run build:all`.
- **Live SSE:** keep the Digital Twin View open for a few seconds so the streaming chart visibly updates — this demonstrates the real-time feed.
- **No edits to the numbers:** every metric quoted (0.96 ROC-AUC, 84.1 min lead time, MAE 5.0/6.5/8.7, confusion 451/35/95/949) is read straight from `ml/metrics.json`. Do not round or paraphrase loosely.
- **Disclaimer on screen at all times.** The banner must be visible in every dashboard shot; if a shot crops it out, reframe.
- **Pacing:** if running long, trim 0:45–1:30 by showing only the top 3 reasons instead of all 6. Do not trim the honesty caveat at 2:15.
