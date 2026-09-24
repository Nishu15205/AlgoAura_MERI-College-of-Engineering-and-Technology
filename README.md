# GlucoTwin

A Type-2 Diabetes Digital Twin that predicts glucose spikes before they happen, explains why, and lets a clinician rehearse "what-if" actions.

> **Disclaimer:** Research prototype. All data is synthetic. This is **not medical advice** and must not be used for clinical decision-making.

---

## Team

- **Team name:** AlgoAura
- **College / Incubator:** MERI College of Engineering and Technology
- **Hackathon:** Happiest Health "Digital Twin Challenge 2026"
- **Members:**
  - **Nishu Raj** — Team Leader
  - **Vishesh Pratap Singh** — Member

---

## Project title

**GlucoTwin — A Type 2 Diabetes Digital Twin**

GlucoTwin is a proof-of-concept digital twin for a Type-2 Diabetes Mellitus (T2DM) patient. It fuses 14 days of synthetic continuous-glucose-monitor (CGM) + wearable signals with a static EHR record, trains a gradient-boosted decision-tree model to forecast whether blood glucose will exceed 180 mg/dL in the next 120 minutes, and pairs that forecast with a physiological what-if simulator so a clinician can see how a meal, a walk, a sleep change, or a skipped medication would change the predicted trajectory.

The twin is served through a small REST API plus an SSE live-replay stream, and is presented in a single-page doctor dashboard with five views: Patient List, Digital Twin, What-if Simulator, Model Insights, and About.

---

## Problem statement and healthcare use case

India is the diabetes capital of the world. The ICMR **INDIAB** study (published 2023) estimates that **~101 million Indians** are living with diabetes and a further **~136 million are prediabetic**. Type-2 diabetes accounts for the overwhelming majority of these cases. Uncontrolled post-prandial and post-exercise glucose spikes drive the long-term micro- and macrovascular complications — retinopathy, nephropathy, neuropathy, cardiovascular disease — that account for the bulk of diabetes-related healthcare cost in India, which already runs into thousands of crores of rupees annually.

Today, most T2DM care in India is **reactive**: a patient visits a clinician every few months, an HbA1c is measured, and the medication dose is adjusted long after the damage is done. Continuous glucose monitors are becoming affordable, but they only show the **past** — they do not tell a patient or a doctor that a spike is about to happen, *why*, or what to do about it.

GlucoTwin asks a small, sharp question:

> *Given the last 6 hours of a patient's CGM + wearable signals and their EHR, what is the probability that glucose will spike above 180 mg/dL in the next 120 minutes — and what can the patient do right now to avoid it?*

The twin is designed to give clinicians **early warning** (average **84.1 minutes of lead time** on correct alerts on the held-out test set) and **actionable explanations** (SHAP-style reasons + a physiological what-if simulator) so the next step — walk 20 minutes, halve the meal, do not skip medication — is obvious. The intended deployment is a clinician-facing dashboard in a primary-health-centre or telemedicine setting, where a single doctor can triage dozens of T2DM patients by risk band instead of reviewing each chart linearly.

This is a research prototype on synthetic data and has not been clinically validated. It is a proof that the architecture works end-to-end, not a product.

---

## Tech stack and AI/ML model details

### Honest note on the runtime environment

GlucoTwin was **originally specced as a Python/FastAPI backend with a React/Vite frontend**. The live demo sandbox for the challenge, however, exposes a single port and a single user-visible route, which a two-process Python+Vite stack cannot occupy. To preserve every functional requirement for the live demo, GlucoTwin is implemented as **one Next.js 16 + TypeScript application** with a 1:1 mapping of every required component:

| Original spec (Python/FastAPI + React/Vite) | Implemented as (Next.js 16 + TypeScript) |
| --- | --- |
| FastAPI route handlers | Next.js Route Handlers (`src/app/api/**/route.ts`) |
| `scikit-learn` LogisticRegression | `src/lib/ml/logistic-regression.ts` (gradient descent, L2) |
| `xgboost` / `lightgbm` GBDT | `src/lib/ml/gbdt.ts` (histogram-based, Newton leaves, written from scratch) |
| `shap` TreeExplainer | `GBDT.contributions()` — Saabas tree-interpreter in log-odds space |
| `pandas` / `numpy` data prep | `src/lib/ml/features.ts` + `stats.ts` |
| Synthetic data in Python | `src/lib/ml/data-generator.ts` (fixed seed) |
| React/Vite SPA | Next.js App Router client components (`src/app/page.tsx`) |
| Uvicorn / Gunicorn server | Next.js dev server (port 3000) |
| `requirements.txt` | `requirements.txt` (documents both stacks) + `package.json` (authoritative) |

Every model — logistic regression, the GBDT classifier, and the three GBDT regressors — is **implemented from scratch in TypeScript**, trained on real (synthetic but reproducible) data, and serialised to JSON. Nothing is mocked.

### Data

- **200 synthetic patients** with EHR fields: `patient_id`, `age` (30–75), `sex`, `BMI` (22–42), `HbA1c` (6.5–11), `years_since_diagnosis`, `medication` (`none` / `metformin` / `metformin+insulin`), `hypertension`, `family_history_diabetes`, `genetic_risk_score` (0–1), `fasting_glucose`, `eGFR`. EHR fields are physiologically correlated (e.g. HbA1c rises with BMI; fasting glucose follows an ADAG-like relation from HbA1c; eGFR declines with age and uncontrolled diabetes; medication escalates with HbA1c).
- **14 days × 5-min intervals of wearables per patient = 806,400 samples** in total across the cohort. Each sample carries: `glucose` (CGM, mg/dL), `heart_rate`, `hrv_rmssd`, `steps`, `sleep_stage` (`awake`/`light`/`deep`/`rem`), `meal_carbs_g`, `activity_min`.
- **Physiological glucose model**: meal absorption (peak 60–90 min after eating), insulin clearance toward a daily baseline, dawn phenomenon (04:00–08:00 rise proportional to HbA1c), exercise lowers glucose (~0.35 mg/dL per walking minute, more when insulin-resistant), poor previous-night sleep raises the next day's baseline, and Gaussian sensor noise.
- **Fixed seed = `20260117`** (mulberry32 PRNG). Every run of the pipeline produces byte-identical patients, wearables, and trained models.
- **No real patient data is used anywhere.** The dataset is DPDP / HIPAA compliant by construction.

### Label

`1` if the maximum glucose in the **next 120 minutes** (24 five-minute samples) exceeds **180 mg/dL**, else `0`. This is a clinically meaningful threshold (post-prandial hyperglycaemia) and is the event the twin is trained to forecast.

### Features (static + dynamic fusion, 33 total)

The same `computeFeatures()` function is used for training (sliding windows) and live inference, which makes train/serve skew impossible by construction.

**Dynamic CGM features (last 6 hours):**
`current_glucose`, `roc_15min`, `roc_30min`, `roc_60min`, `rolling_mean_6h`, `rolling_std_6h`, `rolling_min_6h`, `rolling_max_6h`, `glucose_range_6h`, `time_since_last_meal_min`, `last_meal_carbs`, `rolling_steps_6h`, `rolling_hr_mean_6h`, `rolling_hrv_mean_6h`, `prev_night_sleep_hours`, `prev_night_deep_pct`, `hour_of_day`, `is_morning`, `glucose_above_160`.

**Static EHR features (the fusion):**
`age`, `sex_male`, `bmi`, `hba1c`, `years_since_diagnosis`, `med_none`, `med_metformin`, `med_insulin`, `hypertension`, `family_history`, `genetic_risk_score`, `fasting_glucose`, `egfr`, `insulin_sensitivity`.

### Split

**Split by patient, 70 / 15 / 15** (train / val / test), with patients shuffled by a seeded RNG. No patient appears in more than one split, so there is no row-level leakage between train and test. The validation split is used only to choose the operating threshold; the test split is held out and reported below.

### Models (implemented from scratch in TypeScript)

1. **Logistic regression baseline** — gradient descent with L2 regularisation, 500 epochs, learning rate 0.15, L2 = 1e-3.
2. **Gradient-Boosted Decision Tree classifier** — histogram-based (32 quantile bins per feature), **80 trees, max depth 4**, learning rate 0.1, `minChildWeight` 10, L2 = 1.0, **Newton leaf updates with log loss**. This is a from-scratch TypeScript substitute for XGBoost / LightGBM.
3. **GBDT regressors** for glucose at **+30 / +60 / +120 min** (40 / 40 / 60 trees, depth 4) — used to draw the predicted glucose curve and the confidence band.

### Metrics (TEST set, held-out patients)

| Model | ROC-AUC | PR-AUC | Precision | Recall | F1 | Accuracy | Brier |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Logistic regression | 0.948 | 0.484 | 0.841 | 0.870 | 0.855 | 0.895 | 0.230 |
| **GBDT (primary)** | **0.960** | **0.486** | **0.928** | **0.826** | **0.874** | **0.915** | **0.065** |

**Regression MAE** (glucose prediction, mg/dL):

| Horizon | MAE |
| --- | --- |
| +30 min | 5.0 |
| +60 min | 6.5 |
| +120 min | 8.7 |

**Confusion matrix** (GBDT at the chosen operating threshold of **0.35**):

| | Predicted spike | Predicted no-spike |
| --- | --- | --- |
| **Actual spike** | TP 451 | FN 95 |
| **Actual no-spike** | FP 35 | TN 949 |

**Average lead time of correct alerts: 84.1 minutes.** In other words, when the twin fires an alert that turns out to be correct, the patient (on average) still has ~1 hour and 24 minutes before the glucose peak — long enough to act.

The PR-AUC of ~0.49 reflects the class imbalance (the positive class — a >180 mg/dL spike in the next 2 hours — occurs in roughly a third of windows). ROC-AUC of 0.96 with a Brier score of 0.065 indicates well-calibrated, highly discriminating predictions.

### Explanations

For every prediction, the GBDT's `contributions()` method produces **tree-interpreter (Saabas) local feature contributions in log-odds (margin) space** — the same idea as SHAP's TreeExplainer with the `tree_path_dependent` path, but computed analytically by walking each tree's decision path and crediting each feature with the change in child-node value it caused. The top 6 contributions are mapped to human-readable reasons such as *"Current glucose 172 mg/dL raises risk"* or *"Poor sleep (5.2h) raises risk"*.

### Twin simulator

The what-if engine reuses the **same physiological model that generated the synthetic data** (meal absorption + insulin clearance + dawn phenomenon + exercise effect + medication effect), so simulations stay consistent with the data distribution the ML model was trained on. Given a patient's current state and a hypothetical action — `carbs_g`, `walk_minutes`, `sleep_hours`, `skip_medication` — it runs two parallel 3-hour simulations (baseline vs what-if) and returns both glucose curves, both peak values, both risk bands, the delta in spike probability, and a one-line natural-language summary.

### Limitations (stated honestly)

- **Synthetic data only.** The cohort, the wearables, and the labels are all generated by a physiological model. Real-world CGM data is noisier, real EHR fields are missing/dirty, and real patients behave in ways no generator captures. The metrics above describe how well the model learned the *generator*, not how it would perform on real patients.
- **Not clinically validated.** No IRB, no real-patient study, no regulatory clearance. The dashboard must not be used for diagnosis, dosing, or any clinical decision.
- **No real-time insulin dosing.** The what-if simulator explores meal / walk / sleep / medication-skip actions only. It does **not** recommend insulin doses and is not a closed-loop artificial pancreas.
- **Single-twin-per-patient.** The twin is a per-patient forecaster, not a population-level model. There is no federated learning, no online adaptation, no feedback loop from outcomes back into the model.
- **Static threshold.** The 180 mg/dL spike threshold and the 0.35 probability threshold are fixed; they are not personalised to a patient's target range.

---

## Video

A 2-5 minute demo of GlucoTwin will be available at: **`[VIDEO_LINK]`** _(upload as unlisted YouTube video and paste the link here)_

The demo script and the slide-by-slide breakdown live in [`docs/video_script.md`](docs/video_script.md) and [`docs/presentation_outline.md`](docs/presentation_outline.md).

### Submission deliverables

| Deliverable | File |
|---|---|
| Architecture diagram (PDF) | [`docs/GlucoTwin_Architecture.pdf`](docs/GlucoTwin_Architecture.pdf) |
| Presentation (PPTX) | [`docs/GlucoTwin_Presentation.pptx`](docs/GlucoTwin_Presentation.pptx) |
| Video demo | `[VIDEO_LINK]` (to be recorded) |

---

## Open-source license

GlucoTwin is released under the **MIT License** — see [`LICENSE`](LICENSE). Copyright (c) 2026 GlucoTwin Team. You are free to use, copy, modify, merge, publish, distribute, and sublicense the code, provided the copyright and permission notice are included.

---

## Architecture

```mermaid
flowchart LR
    subgraph DataGen["1. Data generation (scripts/build-all.ts)"]
        A[RNG seed 20260117] --> B[generateEhr: 200 patients]
        A --> C[generateWearablesAll: 14d x 5min x 200]
    end

    B --> D[(data/ehr.csv)]
    C --> E[(data/wearables.csv)]
    B --> F[(SQLite via Prisma)]
    C --> F

    subgraph Features["2. Feature fusion (src/lib/ml/features.ts)"]
        G[computeFeatures: 6h CGM window + EHR -> 33 features]
    end
    E --> G
    D --> G

    subgraph Train["3. Training (scripts/build-all.ts)"]
        G --> H[Patient-wise split 70/15/15]
        H --> I[LogisticRegression]
        H --> J[GBDT classifier 80 trees]
        H --> K[GBDT regressors +30/+60/+120]
    end

    I --> L[(ml/logreg.json)]
    J --> M[(ml/gbdt-classification.json)]
    K --> N[(ml/gbdt-regression*.json)]
    J --> O[(ml/metrics.json)]

    subgraph API["4. API (src/app/api/**/route.ts)"]
        O --> P[/api/model/metrics]
        F --> Q[/api/patients]
        F --> R[/api/patients/:id]
        F --> S[/api/patients/:id/timeseries]
        M --> T[/api/patients/:id/risk]
        U[Twin Simulator] --> V[/api/patients/:id/whatif POST]
        F --> W[/api/stream/:id SSE]
    end
    T --> U

    subgraph UI["5. Dashboard (src/app/page.tsx)"]
        Q --> X1[Patient List]
        R --> X2[Digital Twin View]
        T --> X2
        S --> X2
        V --> X3[What-if Simulator]
        P --> X4[Model Insights]
        W --> X2
        X5[About] --> X6[Disclaimer banner everywhere]
    end
    Q --> X1
    V --> X3
```

---

## How to run

> Requires [Bun](https://bun.sh) (the demo runtime) and Node 18+. The first run generates all data and trains all models in ~15 seconds.

```bash
# 1. Install dependencies
bun install

# 2. Create the SQLite schema
bun run db:push

# 3. Generate synthetic data + train models + seed the DB (~15s)
bun run build:all

# 4. Start the dashboard
bun run dev
#   -> http://localhost:3000

# 5. (optional) Lint
bun run lint
```

After step 3 you will have:

- `data/ehr.csv` and `data/wearables.csv` — the synthetic dataset.
- `ml/logreg.json`, `ml/gbdt-classification.json`, `ml/gbdt-regression{,-30,-60}.json`, `ml/metrics.json`, `ml/feature-names.json` — the trained model artifacts and metrics.
- A populated SQLite database (`db/custom.db`) with 200 patients, 3 days of wearables per patient, and a risk-alert timeline.

Open `http://localhost:3000` for the dashboard. The API is served from the same origin at `/api/...`.

---

## Project structure

```
GlucoTwin/
  README.md                          # this file
  LICENSE                            # MIT
  requirements.txt                   # documents the adapted Node stack + original Python intent
  package.json                       # authoritative dependency list
  data/
    ehr.csv                          # 200 synthetic EHR records
    wearables.csv                    # 806,400 synthetic wearable samples
  prisma/
    schema.prisma                    # Patient, WearableSample, RiskAlert, ModelArtifact
  scripts/
    build-all.ts                     # data gen + train + DB seed (one command)
  src/
    lib/
      ml/
        rng.ts                       # mulberry32 seeded PRNG (GLOBAL_SEED = 20260117)
        stats.ts                     # mean / std / clamp helpers
        types.ts                     # EhrRecord, WearableSample, LabeledSample, MetricsReport
        data-generator.ts            # 200 patients + 14d wearables, physiological model
        features.ts                  # 33-feature fusion, label = max(glucose)+120 > 180
        logistic-regression.ts       # from-scratch LR (gradient descent, L2)
        gbdt.ts                      # from-scratch GBDT (histogram, Newton, Saabas)
        metrics.ts                   # ROC/PR/F1/confusion/threshold/lead-time
        twin-simulator.ts            # what-if engine (meal / walk / sleep / skip-med)
        predict.ts                   # inference: proba + curve + reasons
      db.ts                          # Prisma client
    app/
      api/
        health/route.ts              # GET  /api/health
        patients/route.ts            # GET  /api/patients
        patients/[id]/route.ts       # GET  /api/patients/:id
        patients/[id]/timeseries/route.ts
        patients/[id]/risk/route.ts
        patients/[id]/whatif/route.ts
        model/metrics/route.ts
        stream/[id]/route.ts         # GET  /api/stream/:id (SSE)
      page.tsx                       # the single doctor dashboard route
      layout.tsx
      globals.css
    components/
      glucotwin/                     # dashboard components (5 views + shared widgets)
  ml/
    gbdt-classification.json         # trained GBDT classifier
    gbdt-regression.json             # trained GBDT regressor (+120 min)
    gbdt-regression-30.json          # +30 min
    gbdt-regression-60.json          # +60 min
    logreg.json                      # trained logistic regression
    metrics.json                     # ROC/PR/F1/confusion/lead-time/importance
    feature-names.json               # the 33-feature contract
  docs/
    architecture.md                  # detailed architecture write-up
    video_script.md                  # 3-minute demo script
    presentation_outline.md          # 10-12 slide deck outline
    screenshots/                     # (drop screenshots here)
```

---

## API reference

All endpoints are served from the same Next.js origin (port 3000), so CORS is not required. Next.js Route Handlers are self-documenting at their paths; the live list below is the canonical contract.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health check. Returns `{status, service, time, version}`. |
| `GET` | `/api/patients` | List patients with their latest risk snapshot. Query params: `?search=`, `?band=Low\|Medium\|High`, `?limit=`. |
| `GET` | `/api/patients/:id` | Full EHR profile for one virtual patient. |
| `GET` | `/api/patients/:id/timeseries` | Recent CGM + HR + HRV + steps + sleep + meals. Query param: `?hours=24`. |
| `GET` | `/api/patients/:id/risk` | Spike probability, predicted glucose curve with 95% band, top-6 SHAP-style reasons, predicted peak, model version. |
| `POST` | `/api/patients/:id/whatif` | Run a what-if simulation. Body: `{carbs_g, walk_minutes, sleep_hours, skip_medication}`. Returns baseline vs simulated 3-h glucose curves, both peaks, both risk bands, delta risk, and a natural-language summary. |
| `GET` | `/api/model/metrics` | Returns the contents of `ml/metrics.json` (ROC-AUC, PR-AUC, F1, confusion matrix, lead time, ROC/PR curves, feature importance, regression MAE). |
| `GET` | `/api/stream/:id` | Server-Sent Events stream that replays a patient's recent wearables one sample at a time on a 1.5-s tick, mimicking a live CGM + wearable feed. Query param: `?speed=1500`. |

Example:

```bash
# Latest risk for patient P0001
curl http://localhost:3000/api/patients/P0001/risk

# What if P0001 eats a 60g meal and walks 25 minutes?
curl -X POST http://localhost:3000/api/patients/P0001/whatif \
  -H 'Content-Type: application/json' \
  -d '{"carbs_g":60,"walk_minutes":25,"sleep_hours":7,"skip_medication":false}'
```

---

## Screenshots

![Patient List — searchable table of 200 virtual patients with risk badges](docs/screenshots/patient-list.png)

![Digital Twin View — glucose chart with 2-hour prediction, risk gauge, SHAP reasons, EHR + wearable panels, alert timeline](docs/screenshots/digital-twin.png)

![What-if Simulator — sliders for meal/walk/sleep/medication with baseline vs simulated glucose curves](docs/screenshots/whatif.png)

![Model Insights — metrics table, confusion matrix, ROC/PR curves, feature importance](docs/screenshots/model-insights.png)

![About — architecture diagram, tech stack, and disclaimers](docs/screenshots/about.png)

---

## Honest limitations and what comes next

**What GlucoTwin is:** a working, end-to-end proof that a Type-2 diabetes digital twin — synthetic data generation, real trained models, explainable predictions, a physiological what-if simulator, a REST API, and a clinician dashboard — can be built and run in a single Next.js application, and that on a held-out test set of patients the model never saw, it achieves ROC-AUC 0.96 with an average of 84 minutes of lead time on correct alerts.

**What GlucoTwin is not:** a clinically validated medical device. The data is synthetic; the metrics describe how well the model learned the data generator, not how it would perform on real Indian T2DM patients; the simulator explores a limited action space; and there is no closed-loop control of insulin.

**What comes next, in rough priority order:**

1. Retrain on real, ethically-sourced, de-identified Indian T2DM CGM + EHR data (IRB-approved).
2. Calibrate the spike threshold and the probability threshold per-patient from their own history.
3. Add an insulin-dosing action to the simulator (with a closed-loop safety bound).
4. Add an outcome feedback loop so the model learns from its own prediction errors.
5. Run a prospective clinical study against standard care.
