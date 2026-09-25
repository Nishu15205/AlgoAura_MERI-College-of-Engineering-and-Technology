// ============================================================================
//  Synthetic data generator for GlucoTwin.
//  - generateEhr(): 200 synthetic patients with realistic, correlated EHR fields.
//  - generateWearables(): 14 days @ 5-min intervals per patient, with a simple
//    physiological glucose model (meal absorption, insulin clearance, dawn
//    phenomenon, exercise effect, sleep-quality carryover, sensor noise).
//  All deterministic via a fixed seed. No real patient data is used anywhere.
// ============================================================================

import { RNG, GLOBAL_SEED } from "./rng";
import { clamp } from "./stats";
import type { EhrRecord, WearableSample } from "./types";

// Synthetic name pools (India-specific, fully fictional). Split by sex so a
// patient's name always matches their recorded sex — a small but important
// realism detail that makes the synthetic cohort look genuine, not dummy.
const MALE_FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna",
  "Ishaan", "Rohan", "Rahul", "Amit", "Sanjay", "Vikram", "Karan", "Nikhil",
  "Manoj", "Rajesh", "Anil", "Suresh", "Deepak", "Rakesh", "Vivek", "Akash",
  "Suresh", "Pranav", "Kunal", "Aditya", "Harish", "Mohan", "Naveen", "Yash",
];
const FEMALE_FIRST_NAMES = [
  "Aanya", "Diya", "Saanvi", "Aadhya", "Aaradhya", "Ananya", "Priya", "Pooja",
  "Neha", "Kavya", "Meera", "Riya", "Ira", "Myra", "Tanvi", "Shreya",
  "Deepa", "Lata", "Geeta", "Sunita", "Anjali", "Pallavi", "Sneha", "Madhuri",
  "Reshma", "Bhavna", "Kiran", "Jyoti", "Anita", "Padma", "Renuka", "Varsha",
];
const LAST_NAMES = [
  "Sharma", "Verma", "Patel", "Gupta", "Reddy", "Nair", "Iyer", "Menon",
  "Kapoor", "Malhotra", "Chopra", "Mehta", "Joshi", "Desai", "Rao", "Pillai",
  "Banerjee", "Mukherjee", "Das", "Sen", "Khan", "Sheikh", "Ali", "Singh",
];

export const N_PATIENTS = 200;
export const SAMPLE_INTERVAL_MIN = 5;
export const N_DAYS = 14;
export const SAMPLES_PER_DAY = (24 * 60) / SAMPLE_INTERVAL_MIN; // 288
export const START_TS = Math.floor(new Date("2026-01-01T00:00:00Z").getTime() / 1000);

/** Generate N synthetic EHR records with physiologically correlated fields. */
export function generateEhr(n: number = N_PATIENTS, seed: number = GLOBAL_SEED): EhrRecord[] {
  const rng = new RNG(seed);
  const records: EhrRecord[] = [];
  const usedNames = new Set<string>();

  for (let i = 0; i < n; i++) {
    const patientId = "P" + String(i + 1).padStart(4, "0");

    // Decide sex FIRST, then pick a sex-appropriate name so they always match.
    const sex: "male" | "female" = rng.boolean(0.52) ? "male" : "female";
    const firstPool = sex === "male" ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES;

    // Unique synthetic name
    let name = "";
    do {
      name = `${rng.pick(firstPool)} ${rng.pick(LAST_NAMES)}`;
    } while (usedNames.has(name));
    usedNames.add(name);

    const age = rng.int(30, 75);

    // BMI: skewed higher (T2D cohort), mean ~30, range 22-42.
    // Males in Indian T2D cohorts average slightly higher BMI than females.
    const sexBmiShift = sex === "male" ? 0.6 : -0.4;
    let bmi = clamp(rng.gaussian(30 + sexBmiShift, 4.2), 22, 42);

    // HbA1c: correlated with BMI (higher BMI -> higher HbA1c), range 6.5-11.
    const bmiComponent = ((bmi - 22) / 20) * 1.6; // 0..1.6
    let hba1c = clamp(6.5 + bmiComponent + rng.gaussian(0, 0.55), 6.5, 11);

    // Years since diagnosis: correlated with age and HbA1c
    const diagBase = (age - 30) / 45; // 0..1
    let yearsSinceDiagnosis = Math.round(
      clamp(diagBase * 18 + (hba1c - 6.5) * 1.2 + rng.gaussian(0, 2), 0, 25)
    );

    // Medication: escalates with HbA1c
    let medication: EhrRecord["medication"];
    const medRoll = rng.next();
    if (hba1c < 7.3) {
      medication = medRoll < 0.55 ? "none" : "metformin";
    } else if (hba1c < 8.8) {
      medication = medRoll < 0.7 ? "metformin" : "metformin+insulin";
    } else {
      medication = medRoll < 0.8 ? "metformin+insulin" : "metformin";
    }

    // Hypertension: increases with age and BMI
    const htnProb = clamp(0.12 + (age - 30) / 45 * 0.5 + (bmi - 22) / 20 * 0.25, 0.05, 0.9);
    const hypertension: 0 | 1 = rng.boolean(htnProb) ? 1 : 0;

    const familyHistoryDiabetes: 0 | 1 = rng.boolean(0.55) ? 1 : 0;

    // Genetic risk: correlated with family history
    const geneticRiskScore = clamp(
      rng.gaussian(familyHistoryDiabetes ? 0.62 : 0.38, 0.14),
      0,
      1
    );

    // Fasting glucose from HbA1c via ADAG-like relation: fasting ≈ 28.7*HbA1c - 46.7
    const fastingGlucose = clamp(
      28.7 * hba1c - 46.7 + rng.gaussian(0, 8),
      90,
      220
    );

    // eGFR: declines with age and uncontrolled diabetes. Females have a
    // slightly lower eGFR baseline than males at the same age (~6 mL/min).
    const sexEgfrShift = sex === "male" ? 3 : -3;
    const egfr = clamp(
      120 - 0.75 * age - (hba1c - 6.5) * 2.5 + sexEgfrShift + rng.gaussian(0, 6),
      30,
      120
    );

    records.push({
      patientId,
      name,
      age,
      sex,
      bmi: Math.round(bmi * 10) / 10,
      hba1c: Math.round(hba1c * 10) / 10,
      yearsSinceDiagnosis,
      medication,
      hypertension,
      familyHistoryDiabetes,
      geneticRiskScore: Math.round(geneticRiskScore * 1000) / 1000,
      fastingGlucose: Math.round(fastingGlucose),
      egfr: Math.round(egfr),
    });
  }
  return records;
}

/** Derived insulin-resistance / sensitivity used by both the wearable generator
 *  and the twin simulator (kept here so both share one definition). */
export function insulinProfile(e: EhrRecord) {
  // insulinResistance in [0,1]: higher BMI & HbA1c -> more resistant
  const bmiPart = (e.bmi - 22) / 20; // 0..1
  const hba1cPart = (e.hba1c - 6.5) / 4.5; // 0..1
  let ir = clamp(0.25 * bmiPart + 0.6 * hba1cPart + 0.15 * e.geneticRiskScore, 0.05, 0.95);
  // Medication improves effective sensitivity (more clearance, smaller meal response)
  let medClearanceBoost = 0;
  let medMealReduction = 0;
  if (e.medication === "metformin") {
    medClearanceBoost = 0.18;
    medMealReduction = 0.15;
  } else if (e.medication === "metformin+insulin") {
    medClearanceBoost = 0.4;
    medMealReduction = 0.32;
  }
  const insulinSensitivity = clamp(1 - ir, 0.25, 0.95);
  return { ir, insulinSensitivity, medClearanceBoost, medMealReduction };
}

/** Generate 14 days of 5-min wearable samples for one patient. */
export function generateWearablesForPatient(e: EhrRecord, seed: number): WearableSample[] {
  const rng = new RNG(seed + e.patientId.charCodeAt(1) * 97 + parseInt(e.patientId.slice(1)));
  const { insulinSensitivity, medClearanceBoost, medMealReduction } = insulinProfile(e);

  const samples: WearableSample[] = [];
  const baseline = e.fastingGlucose; // mg/dL fasting baseline

  // Glucose model state
  let glucose = baseline;
  let gutCarbs = 0; // carbs waiting to be absorbed
  let dayBaseline = baseline;

  for (let d = 0; d < N_DAYS; d++) {
    // Previous-night sleep quality affects today's baseline (poor sleep -> higher)
    const sleepHours = clamp(rng.gaussian(6.6, 1.1), 3.5, 9);
    const deepPct = clamp(rng.gaussian(0.18, 0.05), 0.05, 0.3);
    const sleepQuality = clamp((sleepHours - 5) / 4 + (deepPct - 0.1) / 0.2, 0, 2) / 2; // 0..1
    const sleepPenalty = (1 - sleepQuality) * 12; // up to +12 mg/dL
    dayBaseline = baseline + sleepPenalty;

    // Plan meals for the day: 3-4 meals with realistic timing & carbs
    const meals = planMeals(rng);

    // Plan a walk or two for the day
    const walks = planWalks(rng);

    for (let s = 0; s < SAMPLES_PER_DAY; s++) {
      const minutesOfDay = s * SAMPLE_INTERVAL_MIN; // 0..1435
      const hour = minutesOfDay / 60;
      const ts = START_TS + (d * SAMPLES_PER_DAY + s) * (SAMPLE_INTERVAL_MIN * 60);
      const date = new Date(ts * 1000);

      // ---- sleep stage ----
      let sleepStage: WearableSample["sleepStage"] = "awake";
      if (hour >= 23 || hour < 7) {
        // night: cycle through stages
        const cycle = Math.floor((minutesOfDay % 480) / 90);
        sleepStage = (["deep", "light", "rem", "light"] as const)[cycle % 4];
        if (hour >= 6.5 && hour < 7 && rng.boolean(0.5)) sleepStage = "awake";
      } else if (hour >= 13 && hour < 13.5 && rng.boolean(0.3)) {
        sleepStage = "light"; // afternoon nap sometimes
      }

      const isAwake = sleepStage === "awake";

      // ---- meal absorption model ----
      // carbs move from gut to plasma; peak ~60-90 min after meal
      const absorptionRate = 0.07; // per 5-min step
      const absorbed = gutCarbs * absorptionRate;
      gutCarbs = Math.max(0, gutCarbs - absorbed);
      // plasma glucose rise from absorbed carbs (mg/dL per gram), modulated by sensitivity & meds
      const carbsToGlucose = (1.7 * (1 - medMealReduction)) / insulinSensitivity;
      let dGut = absorbed * carbsToGlucose;

      // add new meals starting at this minute
      for (const m of meals) {
        if (m.minute === minutesOfDay) gutCarbs += m.carbs;
      }

      // ---- insulin clearance toward dayBaseline ----
      const clearance = (0.05 + medClearanceBoost) * insulinSensitivity; // per 5-min
      const dClear = (glucose - dayBaseline) * clearance;

      // ---- dawn phenomenon: 04:00-08:00 rise ----
      let dDawn = 0;
      if (hour >= 4 && hour < 8) {
        dDawn = (e.hba1c - 6.5) * 0.6 * (1 - Math.abs(hour - 6) / 2);
      }

      // ---- exercise effect ----
      let activityMin = 0;
      let steps = 0;
      for (const w of walks) {
        if (minutesOfDay >= w.start && minutesOfDay < w.start + w.duration) {
          activityMin = Math.min(5, w.duration - (minutesOfDay - w.start));
          steps = rng.int(60, 120); // steps in this 5-min bucket while walking
        }
      }
      // walking lowers glucose: ~0.35 mg/dL per minute, more if resistant (less efficient)
      const dExercise = -activityMin * (0.35 + 0.2 * (1 - insulinSensitivity));

      // ---- heart rate ----
      let hr = 72;
      if (!isAwake) hr = 58 + Math.round((hour % 2) * 2);
      if (activityMin > 0) hr = 95 + rng.int(0, 25);
      else if (gutCarbs > 0) hr += 6; // post-meal
      hr += Math.round(rng.gaussian(0, 3));
      hr = clamp(hr, 45, 170);

      // ---- HRV (rmssd): higher when resting, lower when glucose high / poor sleep ----
      let hrv = 42;
      if (!isAwake) hrv += 18;
      if (activityMin > 0) hrv -= 10;
      hrv -= Math.max(0, (glucose - 120) * 0.08);
      hrv -= sleepPenalty * 0.6;
      hrv += rng.gaussian(0, 4);
      hrv = clamp(hrv, 12, 110);

      // ---- integrate glucose ----
      glucose = glucose + dGut - dClear + dDawn + dExercise + rng.gaussian(0, 2.5);
      glucose = clamp(glucose, 40, 400);

      // ---- meal carbs marker at this ts ----
      let mealCarbsG = 0;
      for (const m of meals) {
        if (m.minute === minutesOfDay) mealCarbsG = m.carbs;
      }

      // steps when not walking but awake: ambient movement
      if (activityMin === 0 && isAwake) {
        steps = rng.boolean(0.35) ? rng.int(2, 40) : 0;
      }

      samples.push({
        patientId: e.patientId,
        ts,
        tsHuman: date.toISOString(),
        glucose: Math.round(glucose * 10) / 10,
        heartRate: hr,
        hrvRmssd: Math.round(hrv * 10) / 10,
        steps,
        sleepStage,
        mealCarbsG,
        activityMin,
      });
    }
  }
  return samples;
}

/** Plan 3-4 meals for a day with realistic timing and carb amounts. */
function planMeals(rng: RNG): { minute: number; carbs: number }[] {
  const meals: { minute: number; carbs: number }[] = [];
  // Breakfast 7:00-9:00
  meals.push({ minute: rng.int(7 * 60, 9 * 60), carbs: rng.int(35, 70) });
  // Lunch 12:00-13:30
  meals.push({ minute: rng.int(12 * 60, 13 * 60 + 30), carbs: rng.int(50, 90) });
  // Dinner 19:00-21:00
  meals.push({ minute: rng.int(19 * 60, 21 * 60), carbs: rng.int(55, 100) });
  // Optional snack 16:00-17:00
  if (rng.boolean(0.5)) meals.push({ minute: rng.int(16 * 60, 17 * 60), carbs: rng.int(15, 40) });
  return meals;
}

/** Plan 0-2 walks per day. */
function planWalks(rng: RNG): { start: number; duration: number }[] {
  const walks: { start: number; duration: number }[] = [];
  const n = rng.boolean(0.7) ? 1 : rng.boolean(0.5) ? 2 : 0;
  for (let i = 0; i < n; i++) {
    const start = rng.int(8 * 60, 20 * 60);
    walks.push({ start, duration: rng.int(20, 55) });
  }
  return walks;
}

/** Generate wearables for all patients (kept separate so training can stream). */
export function generateWearablesAll(
  ehr: EhrRecord[],
  seed: number = GLOBAL_SEED + 1
): Map<string, WearableSample[]> {
  const map = new Map<string, WearableSample[]>();
  for (const e of ehr) {
    map.set(e.patientId, generateWearablesForPatient(e, seed));
  }
  return map;
}
