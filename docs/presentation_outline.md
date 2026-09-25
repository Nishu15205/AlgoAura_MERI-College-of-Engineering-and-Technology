# GlucoTwin — Presentation Outline

A 10–12 slide deck for the Happiest Health "Digital Twin Challenge 2026" pitch. Each slide lists the bullet content (what goes on the slide) and the speaker notes (what the presenter says). Estimated runtime: 8–10 minutes of speaking, leaving room for Q&A.

**Team:** `[TeamName]` — `[Member 1, Member 2, Member 3, Member 4, Member 5]`, `[CollegeName]`.

---

## Slide 1 — Title

**Content:**
- GlucoTwin — A Type 2 Diabetes Digital Twin
- Happiest Health Digital Twin Challenge 2026
- Team `[TeamName]` · `[CollegeName]`
- MIT License · Research prototype · Synthetic data · Not medical advice

**Speaker notes:**
> Good [morning/afternoon]. We're `[TeamName]` from `[CollegeName]`, and this is GlucoTwin — a digital twin for Type-2 diabetes that predicts glucose spikes, explains them, and lets a clinician rehearse what to do. Everything you'll see runs on synthetic data and is not a medical device.

---

## Slide 2 — The problem (India-specific)

**Content:**
- ~101 million Indians live with diabetes (ICMR INDIAB, 2023) — the most of any country.
- A further ~136 million are prediabetic.
- Post-prandial and post-exercise glucose spikes drive retinopathy, nephropathy, neuropathy, CVD.
- Care today is reactive: HbA1c every few months → dose adjusted long after the damage.
- CGMs are becoming affordable but only show the past, not the next 2 hours.

**Speaker notes:**
> India is the diabetes capital of the world. The damage — eye, kidney, nerve, heart — is driven by glucose spikes that today's care only sees in retrospect. CGMs show the past. We need a tool that sees the next two hours.

---

## Slide 3 — The question GlucoTwin asks

**Content:**
- Given the last 6 hours of CGM + wearables and the EHR, what is the probability that glucose exceeds 180 mg/dL in the next 120 minutes?
- And: what can the patient do right now to avoid it?
- Deployment target: clinician-facing dashboard in a PHC or telemedicine setting; triage dozens of T2DM patients by risk band.

**Speaker notes:**
> GlucoTwin asks one sharp question: will glucose spike in the next two hours, and if so, what can the patient do about it right now? The deployment is a dashboard where one doctor triages many patients by risk instead of reviewing each chart linearly.

---

## Slide 4 — The digital twin concept

**Content:**
- A per-patient virtual model that fuses static EHR data with dynamic wearable signals.
- Three capabilities: (1) forecast the spike, (2) explain why, (3) simulate what-if actions.
- Diagram: EHR + CGM/wearables → feature fusion → GBDT model → prediction + reasons; physiological simulator → what-if curves.

**Speaker notes:**
> A digital twin is a virtual model of a specific patient that you can query and perturb. GlucoTwin's twin does three things: it forecasts the spike, it explains the forecast, and it simulates interventions.

---

## Slide 5 — Data & features

**Content:**
- 200 synthetic patients, fixed seed 20260117 (reproducible).
- EHR: age, sex, BMI, HbA1c, years since diagnosis, medication, hypertension, family history, genetic risk, fasting glucose, eGFR.
- Wearables: 14 days × 5-min intervals = 806,400 samples (glucose, HR, HRV, steps, sleep, meal carbs, activity).
- Physiological glucose model: meal absorption (peak 60–90 min), insulin clearance, dawn phenomenon, exercise effect, sleep carryover, sensor noise.
- 33-feature fusion: 19 dynamic CGM (last 6h) + 14 static EHR.
- Label: 1 if max glucose in next 120 min > 180 mg/dL.

**Speaker notes:**
> We generated 200 synthetic patients with physiologically correlated EHR fields and 14 days of 5-minute wearable samples each — over 800,000 samples total. The glucose trace follows a real physiological model: meals peak at 60–90 minutes, insulin clears toward a baseline, the dawn phenomenon raises glucose in the early morning, exercise lowers it, and poor sleep raises the next day's baseline. The label is a binary spike forecast.

---

## Slide 6 — Split & leakage prevention

**Content:**
- Split by patient, 70 / 15 / 15 (train / val / test).
- No patient appears in more than one split → no row-level leakage.
- Val is used only to choose the operating threshold (max F1).
- Test is held out; all reported metrics are on test patients the model never saw.

**Speaker notes:**
> Consecutive 5-minute windows from the same patient are highly correlated, so a random row split would leak. We split by patient — 140 for training, 30 for validation, 30 for testing — and report every metric on the held-out 30. The model has never seen those patients.

---

## Slide 7 — Models (from scratch in TypeScript)

**Content:**
- Logistic regression baseline: gradient descent, L2.
- GBDT classifier: histogram-based (32 bins), 80 trees, depth 4, Newton leaf updates, log loss — a from-scratch XGBoost substitute.
- GBDT regressors for glucose at +30 / +60 / +120 min.
- All serialised to JSON; the whole ML core has zero Python dependency.

**Speaker notes:**
> Every model is implemented from scratch in TypeScript — including the GBDT, which uses histogram binning, Newton leaf updates, and log loss, the same design as XGBoost. Nothing is mocked; the artifacts are plain JSON.

---

## Slide 8 — Results (the metrics table)

**Content:**

| Model | ROC-AUC | PR-AUC | Precision | Recall | F1 | Accuracy | Brier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Logistic regression | 0.948 | 0.484 | 0.841 | 0.870 | 0.855 | 0.895 | 0.230 |
| **GBDT (primary)** | **0.960** | **0.486** | **0.928** | **0.826** | **0.874** | **0.915** | **0.065** |

- Regression MAE: +30 min = 5.0, +60 min = 6.5, +120 min = 8.7 mg/dL.
- Confusion (GBDT @ threshold 0.35): TP 451 / FP 35 / FN 95 / TN 949.
- **Average lead time on correct alerts: 84.1 minutes.**

**Speaker notes:**
> On the held-out test patients: ROC-AUC 0.96, F1 0.87, Brier 0.065 — well-calibrated and highly discriminating. The regression twins predict glucose at 30, 60, and 120 minutes with mean absolute errors of 5, 6.5, and 8.7 mg/dL. Most importantly, when the twin fires a correct alert, the patient has on average 84 minutes of lead time — long enough to act.

---

## Slide 9 — Explanations & the twin simulator

**Content:**
- Explanations: tree-interpreter (Saabas) local contributions in log-odds space — the same idea as SHAP's TreeExplainer. Top-6 reasons mapped to prose: "Current glucose 172 raises risk", "Poor sleep (5.2h) raises risk", "HbA1c 8.4 raises risk".
- Twin simulator: physiological what-if (meal carbs, walk minutes, sleep hours, skip medication) → baseline vs simulated 3-h glucose curve + delta in spike risk.
- Same physiological model that generated the training data → counterfactuals are physically plausible and consistent with the learned risk surface.

**Speaker notes:**
> For every prediction the twin lists the top six reasons, computed by walking each tree's decision path and crediting each feature with the change it caused — the Saabas method, additive and exact. The what-if simulator reuses the same physiological model that generated the training data, so a clinician can see in seconds whether a 25-minute walk cancels a 60-gram meal.

---

## Slide 10 — System architecture & how to run

**Content:**
- One Next.js 16 + TypeScript app (honest adaptation: originally specced as Python/FastAPI + React/Vite; the demo sandbox runs a single port, so the whole twin is one Next.js app with a 1:1 component mapping).
- Pipeline: data gen → CSV + SQLite → 33-feature fusion → patient-wise split → train LR + GBDT → JSON artifacts → REST API + SSE stream → 5-view dashboard.
- API: `/api/health`, `/api/patients`, `/api/patients/:id`, `/api/patients/:id/timeseries`, `/api/patients/:id/risk`, `/api/patients/:id/whatif` (POST), `/api/model/metrics`, `/api/stream/:id` (SSE).
- Run it:
  ```
  bun install
  bun run db:push
  bun run build:all   # ~15s: data + train + seed
  bun run dev         # http://localhost:3000
  ```

**Speaker notes:**
> Everything runs in one Next.js app. We were originally specced as Python plus Vite, but the demo environment runs a single port, so we implemented the whole twin — including the from-scratch GBDT — in TypeScript. One command rebuilds the data, retrains the models, and seeds the database in about fifteen seconds.

---

## Slide 11 — Honest limitations

**Content:**
- Synthetic data only — metrics describe how well the model learned the generator, not real-patient performance.
- Not clinically validated; no IRB, no regulatory clearance; not a medical device.
- No real-time insulin dosing; the simulator explores meal / walk / sleep / skip-medication only.
- Static 180 mg/dL spike threshold and 0.35 probability threshold (not personalised).
- Single-twin-per-patient; no federated learning, no online adaptation, no outcome feedback loop.

**Speaker notes:**
> We want to be honest. The data is synthetic, so the metrics are an architecture proof, not a clinical claim. There is no insulin dosing, no closed loop, no real-patient validation. The threshold is not personalised. This is a proof that the architecture works end-to-end.

---

## Slide 12 — What comes next & close

**Content:**
- Retrain on real, ethically-sourced, de-identified Indian T2DM CGM + EHR data (IRB-approved).
- Per-patient threshold calibration from each patient's own history.
- Add an insulin-dosing action to the simulator (with a closed-loop safety bound).
- Outcome feedback loop so the model learns from its own prediction errors.
- Prospective clinical study against standard care.
- Open source under MIT. Thank you. Team `[TeamName]`, `[CollegeName]`.

**Speaker notes:**
> Next, in rough priority order: real data, per-patient thresholds, insulin dosing in the simulator, an outcome feedback loop, and a prospective clinical trial. GlucoTwin is open source under MIT. Thank you — we're happy to take questions.
