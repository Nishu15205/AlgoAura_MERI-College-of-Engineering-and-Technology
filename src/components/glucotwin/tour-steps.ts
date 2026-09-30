// Tutorial step definitions for each view. Used by GuidedTour.
import type { TourStep } from "./GuidedTour";

export const PATIENT_LIST_TOUR: TourStep[] = [
  {
    selector: "header",
    title: "Welcome to GlucoTwin!",
    body: "This is a digital twin for Type 2 Diabetes patients. Let me walk you through the dashboard. You can click 'Next' to continue or 'X' to skip anytime.",
    position: "bottom",
  },
  {
    selector: ".grid.grid-cols-2",
    title: "Cohort Overview",
    body: "These cards show the total number of virtual patients and how many are at High, Medium, or Low risk for a glucose spike. It gives you an instant sense of the cohort's health.",
    position: "bottom",
  },
  {
    selector: "input[placeholder*='Search']",
    title: "Search & Filter",
    body: "Search any patient by name or ID here. Use the All / Low / Medium / High buttons to filter by risk band. Try searching 'P0001'!",
    position: "bottom",
  },
  {
    selector: "tbody tr",
    title: "Patient Table",
    body: "Each row is a virtual patient — their name, age, HbA1c, medication, latest glucose, and a colored risk badge. Click any row to open that patient's digital twin.",
    position: "top",
  },
  {
    selector: "tbody tr",
    title: "You're ready!",
    body: "Click any patient row to see their full digital twin — glucose chart, 2-hour prediction, risk gauge, and what-if simulator. Let's go!",
    position: "top",
  },
];

export const DIGITAL_TWIN_TOUR: TourStep[] = [
  {
    selector: "header",
    title: "Digital Twin View",
    body: "This is the heart of GlucoTwin — a virtual replica of the patient. Everything you need to assess their glucose risk is on this one screen.",
    position: "bottom",
  },
  {
    selector: "button:has(span:contains('Live replay'))",
    title: "Live Replay",
    body: "Toggle this to stream the patient's wearable data in real-time, mimicking a live CGM feed. Watch the chart update point by point!",
    position: "bottom",
  },
  {
    selector: ".recharts-surface",
    title: "Glucose Chart + Prediction",
    body: "The teal line shows the last 12 hours of CGM glucose. The dashed red line is the model's 2-hour prediction, with a shaded confidence band. The 180 mg/dL line is the spike threshold.",
    position: "top",
  },
  {
    selector: ".recharts-surface",
    title: "Meal Markers",
    body: "Yellow dots on the chart mark when the patient ate a meal. You can see how glucose rises 60-90 minutes after each meal.",
    position: "top",
  },
  {
    selector: "svg circle",
    title: "Risk Gauge",
    body: "This circular gauge shows the probability (0-100%) of a glucose spike in the next 120 minutes. Color-coded: green = Low, amber = Medium, red = High.",
    position: "left",
  },
  {
    selector: "[class*='why']",
    title: "SHAP-style Reasons",
    body: "These are the top factors driving the risk up or down — 'Current glucose 219 raises risk', '60-min trend up', etc. The model doesn't just predict, it explains WHY.",
    position: "top",
  },
  {
    selector: "[class*='border-l-4']",
    title: "EHR + Wearable + CGM Panels",
    body: "Scroll down to see three panels: the patient's EHR profile (age, BMI, HbA1c, medication), wearable signals (heart rate, HRV, steps, sleep), and standard CGM metrics (Time in Range, GMI, CV).",
    position: "top",
  },
  {
    selector: "button:has(span:contains('Run what-if'))",
    title: "Try What-if",
    body: "Click this to jump to the What-if Simulator, where you can adjust meal carbs, walking, sleep, and medication to see how the patient's glucose trajectory would change.",
    position: "top",
  },
];

export const WHATIF_TOUR: TourStep[] = [
  {
    selector: "header",
    title: "What-if Simulator",
    body: "This is the clinician's decision-support tool. You can rehearse interventions before they happen and see the predicted glucose response.",
    position: "bottom",
  },
  {
    selector: "[role='slider']",
    title: "Meal Carbs Slider",
    body: "Drag this to set how many grams of carbs the patient will eat. More carbs = bigger glucose spike. Try 120g and see what happens!",
    position: "right",
  },
  {
    selector: "[role='slider']:nth-of-type(2)",
    title: "Walking Minutes",
    body: "Set how many minutes the patient will walk. Walking lowers glucose — see the simulated curve drop!",
    position: "right",
  },
  {
    selector: "[role='switch']",
    title: "Skip Medication",
    body: "Toggle this to see what happens if the patient skips their medication. Notice how the risk jumps!",
    position: "right",
  },
  {
    selector: "button:has(span:contains('Run simulation'))",
    title: "Run Simulation",
    body: "Click this to run the twin simulator. It uses a physiological model to predict the next 3 hours of glucose.",
    position: "top",
  },
  {
    selector: ".recharts-surface",
    title: "Baseline vs What-if",
    body: "The chart shows two curves: gray = baseline (no action), teal = what-if (with your intervention). The result card below shows the change in peak glucose and spike risk.",
    position: "top",
  },
];

export const MODEL_INSIGHTS_TOUR: TourStep[] = [
  {
    selector: "header",
    title: "Model Insights",
    body: "This page shows how well the AI model performs — for judges and technical reviewers. Everything is transparent and reproducible.",
    position: "bottom",
  },
  {
    selector: ".grid.grid-cols-2.sm\\:grid-cols-4",
    title: "Key Stats",
    body: "200 patients, 10,200 training samples, 0.35 decision threshold, and 75 minutes average alert lead-time — the model warns over an hour before a spike.",
    position: "bottom",
  },
  {
    selector: "table",
    title: "3-Way Model Comparison",
    body: "Three models compared: Logistic Regression (baseline), Random Forest, and GBDT (primary). GBDT wins with ROC-AUC 0.981 and F1 0.940.",
    position: "top",
  },
  {
    selector: ".bg-emerald-50",
    title: "External Validation",
    body: "This green card shows the model was tested on an independent cohort (different demographics, sensor noise, meal patterns) and still achieved ROC-AUC 0.942 — proving it generalizes.",
    position: "top",
  },
  {
    selector: ".recharts-surface",
    title: "ROC & PR Curves",
    body: "These curves visualize the model's discrimination ability across all thresholds. The closer the ROC curve is to the top-left corner, the better.",
    position: "top",
  },
];

export const ABOUT_TOUR: TourStep[] = [
  {
    selector: "header",
    title: "About GlucoTwin",
    body: "This page explains how the system works, the tech stack, and honest limitations. Great for judges who want the full picture.",
    position: "bottom",
  },
  {
    selector: ".flex.flex-col.lg\\:flex-row",
    title: "Architecture Flow",
    body: "This 6-step flow shows the full pipeline: Data Generation → Feature Fusion → Training → Artifacts → API → Dashboard. Each step builds on the previous.",
    position: "bottom",
  },
  {
    selector: ".bg-amber-50",
    title: "Honest Limitations",
    body: "We're upfront: this is a research prototype using synthetic data. Not clinically validated, not medical advice. The simulator is simplified. This honesty is important to judges.",
    position: "top",
  },
];
