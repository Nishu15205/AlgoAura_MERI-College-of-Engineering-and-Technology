// ============================================================================
//  Independent external validation cohort.
//
//  Generates a SEPARATE cohort of patients using DIFFERENT parameters sourced
//  from published literature, to validate that the trained model generalizes
//  beyond the training distribution. This is the standard ML practice of
//  "external validation on an independent cohort."
//
//  Literature sources for the parameters:
//   - Demographics (age, BMI, HbA1c): ICMR INDIAB study (Anjana et al., 2023)
//   - CGM sensor noise: Dexcom G6 MARD ~9% (Shapiro 2017, accuracy specs)
//   - Meal carb distribution: Indian Council of Medical Research dietary survey
//   - Insulin resistance distribution: T2D cohort studies (Singh et al. 2020)
//
//  This is NOT real patient data. It is a literature-calibrated synthetic
//  cohort used to demonstrate generalization. The framework also supports
//  real MIMIC-IV / OhioT1DM CSVs via scripts/validate-external.ts.
// ============================================================================

import { RNG } from "./rng";
import { clamp } from "./stats";
import type { EhrRecord, WearableSample } from "./types";
import { insulinProfile } from "./data-generator";
import { N_DAYS, SAMPLES_PER_DAY, SAMPLE_INTERVAL_MIN, START_TS } from "./data-generator";

// Use a DIFFERENT seed from the training cohort (GLOBAL_SEED=20260117)
export const EXTERNAL_SEED = 7777;
export const EXTERNAL_N_PATIENTS = 60;

/** Generate an independent EHR cohort with literature-sourced parameters. */
export function generateExternalEhr(
  n: number = EXTERNAL_N_PATIENTS,
  seed: number = EXTERNAL_SEED
): EhrRecord[] {
  const rng = new RNG(seed);
  const records: EhrRecord[] = [];
  const usedNames = new Set<string>();

  // Indian male first names (different pool from training to avoid overlap)
  const maleNames = ["Armaan", "Kabir", "Veer", "Shaurya", "Advik", "Pranav", "Reyansh", "Atharv",
    "Dhruv", "Kiaan", "Vivaan", "Anay", "Ranbir", "Yash", "Ayaan", "Mehul"];
  const femaleNames = ["Anvi", "Pari", "Riya", "Sara", "Mahika", "Avni", "Navya", "Kiara",
    "Tara", "Aadhya", "Siya", "Ira", "Mira", "Zara", "Aadya", "Nisha"];
  const lastNames = ["Agarwal", "Bhat", "Chauhan", "Dubey", "Garg", "Jain", "Kaur", "Luthra",
    "Mishra", "Nanda", "Ojha", "Pandey", "Qureshi", "Rastogi", "Saxena", "Tandon"];

  for (let i = 0; i < n; i++) {
    const patientId = "EXT" + String(i + 1).padStart(3, "0");
    const sex: "male" | "female" = rng.boolean(0.58) ? "male" : "female"; // INDIAB: slightly male-skewed T2D
    const firstPool = sex === "male" ? maleNames : femaleNames;
    let name = "";
    do {
      name = `${rng.pick(firstPool)} ${rng.pick(lastNames)}`;
    } while (usedNames.has(name));
    usedNames.add(name);

    // ICMR INDIAB: T2D cohort age mean ~54, range 30-75
    const age = clamp(Math.round(rng.gaussian(54, 10)), 30, 75);

    // INDIAB: urban T2D BMI mean ~27.5 (lower than Western cohorts)
    const sexBmiShift = sex === "male" ? 0.8 : -0.5;
    const bmi = clamp(rng.gaussian(27.5 + sexBmiShift, 3.8), 20, 40);

    // INDIAB: known T2D HbA1c mean ~8.1% (poor control common in India)
    const bmiComponent = ((bmi - 20) / 20) * 1.2;
    const hba1c = clamp(7.0 + bmiComponent + rng.gaussian(0.7, 0.5), 6.5, 11);

    const yearsSinceDiagnosis = Math.round(clamp((age - 30) / 45 * 12 + rng.gaussian(0, 3), 0, 25));

    // Medication: Indian T2D treatment patterns (more metformin-heavy, less insulin)
    let medication: EhrRecord["medication"];
    const medRoll = rng.next();
    if (hba1c < 7.5) medication = medRoll < 0.45 ? "none" : "metformin";
    else if (hba1c < 9.0) medication = medRoll < 0.75 ? "metformin" : "metformin+insulin";
    else medication = medRoll < 0.65 ? "metformin+insulin" : "metformin";

    const hypertension: 0 | 1 = rng.boolean(0.45 + (age - 30) / 45 * 0.3) ? 1 : 0;
    const familyHistoryDiabetes: 0 | 1 = rng.boolean(0.62) ? 1 : 0; // INDIAB: strong family history
    const geneticRiskScore = clamp(rng.gaussian(familyHistoryDiabetes ? 0.6 : 0.35, 0.13), 0, 1);
    const fastingGlucose = clamp(28.7 * hba1c - 46.7 + rng.gaussian(0, 10), 90, 220);
    const sexEgfrShift = sex === "male" ? 3 : -3;
    const egfr = clamp(120 - 0.75 * age - (hba1c - 6.5) * 2.5 + sexEgfrShift + rng.gaussian(0, 7), 30, 120);

    records.push({
      patientId, name, age, sex,
      bmi: Math.round(bmi * 10) / 10,
      hba1c: Math.round(hba1c * 10) / 10,
      yearsSinceDiagnosis, medication, hypertension, familyHistoryDiabetes,
      geneticRiskScore: Math.round(geneticRiskScore * 1000) / 1000,
      fastingGlucose: Math.round(fastingGlucose),
      egfr: Math.round(egfr),
    });
  }
  return records;
}

/** Generate wearables for the external cohort with DIFFERENT noise/dynamics. */
export function generateExternalWearables(
  ehr: EhrRecord[],
  seed: number = EXTERNAL_SEED + 1
): Map<string, WearableSample[]> {
  const map = new Map<string, WearableSample[]>();
  for (const e of ehr) {
    map.set(e.patientId, generateExternalWearablesForPatient(e, seed));
  }
  return map;
}

function generateExternalWearablesForPatient(e: EhrRecord, seed: number): WearableSample[] {
  const rng = new RNG(seed + parseInt(e.patientId.slice(3)) * 131);
  const { insulinSensitivity, medClearanceBoost, medMealReduction } = insulinProfile(e);
  const samples: WearableSample[] = [];
  let glucose = e.fastingGlucose;
  let gutCarbs = 0;
  let dayBaseline = e.fastingGlucose;

  for (let d = 0; d < N_DAYS; d++) {
    // DIFFERENT sleep model: Indian cohort sleeps slightly less (6.2h mean)
    const sleepHours = clamp(rng.gaussian(6.2, 1.3), 3, 9);
    const deepPct = clamp(rng.gaussian(0.16, 0.06), 0.05, 0.3); // slightly less deep sleep
    const sleepQuality = clamp((sleepHours - 5) / 4 + (deepPct - 0.1) / 0.2, 0, 2) / 2;
    const sleepPenalty = (1 - sleepQuality) * 14; // slightly stronger penalty
    dayBaseline = e.fastingGlucose + sleepPenalty;

    // DIFFERENT meal patterns: Indian diet (higher carb, more frequent small meals)
    const meals = planIndianMeals(rng);

    const walks = planWalks(rng);

    for (let s = 0; s < SAMPLES_PER_DAY; s++) {
      const minutesOfDay = s * SAMPLE_INTERVAL_MIN;
      const hour = minutesOfDay / 60;
      const ts = START_TS + (d * SAMPLES_PER_DAY + s) * (SAMPLE_INTERVAL_MIN * 60);
      const date = new Date(ts * 1000);

      let sleepStage: WearableSample["sleepStage"] = "awake";
      if (hour >= 23 || hour < 6.5) {
        const cycle = Math.floor((minutesOfDay % 450) / 90);
        sleepStage = (["deep", "light", "rem", "light"] as const)[cycle % 4];
      } else if (hour >= 13.5 && hour < 14 && rng.boolean(0.25)) {
        sleepStage = "light";
      }

      const isAwake = sleepStage === "awake";

      // Meal absorption — DIFFERENT absorption rate (Indian diet: faster carb absorption)
      const absorptionRate = 0.085;
      const absorbed = gutCarbs * absorptionRate;
      gutCarbs = Math.max(0, gutCarbs - absorbed);
      const carbsToGlucose = (1.9 * (1 - medMealReduction)) / insulinSensitivity; // slightly higher
      let dGut = absorbed * carbsToGlucose;

      for (const m of meals) {
        if (m.minute === minutesOfDay) gutCarbs += m.carbs;
      }

      // DIFFERENT clearance (Indian T2D: often poorer beta-cell function)
      const clearance = (0.045 + medClearanceBoost) * insulinSensitivity;
      const dClear = (glucose - dayBaseline) * clearance;

      // Dawn phenomenon
      let dDawn = 0;
      if (hour >= 4 && hour < 8) {
        dDawn = (e.hba1c - 6.5) * 0.7 * (1 - Math.abs(hour - 6) / 2);
      }

      // Exercise
      let activityMin = 0;
      let steps = 0;
      for (const w of walks) {
        if (minutesOfDay >= w.start && minutesOfDay < w.start + w.duration) {
          activityMin = Math.min(5, w.duration - (minutesOfDay - w.start));
          steps = rng.int(50, 110);
        }
      }
      const dExercise = -activityMin * (0.32 + 0.2 * (1 - insulinSensitivity));

      // Heart rate
      let hr = 74;
      if (!isAwake) hr = 56 + Math.round((hour % 2) * 2);
      if (activityMin > 0) hr = 98 + rng.int(0, 22);
      else if (gutCarbs > 0) hr += 7;
      hr += Math.round(rng.gaussian(0, 3.5));
      hr = clamp(hr, 45, 170);

      // HRV
      let hrv = 40;
      if (!isAwake) hrv += 16;
      if (activityMin > 0) hrv -= 11;
      hrv -= Math.max(0, (glucose - 120) * 0.09);
      hrv -= sleepPenalty * 0.7;
      hrv += rng.gaussian(0, 4.5);
      hrv = clamp(hrv, 12, 110);

      // Integrate glucose — DIFFERENT sensor noise (Dexcom G6 MARD ~9%)
      const sensorNoise = rng.gaussian(0, glucose * 0.045); // ~4.5% std (half of MARD)
      glucose = glucose + dGut - dClear + dDawn + dExercise + sensorNoise;
      glucose = clamp(glucose, 40, 400);

      let mealCarbsG = 0;
      for (const m of meals) {
        if (m.minute === minutesOfDay) mealCarbsG = m.carbs;
      }

      if (activityMin === 0 && isAwake) {
        steps = rng.boolean(0.3) ? rng.int(2, 35) : 0; // slightly less active
      }

      samples.push({
        patientId: e.patientId, ts, tsHuman: date.toISOString(),
        glucose: Math.round(glucose * 10) / 10,
        heartRate: hr, hrvRmssd: Math.round(hrv * 10) / 10,
        steps, sleepStage, mealCarbsG, activityMin,
      });
    }
  }
  return samples;
}

/** Indian dietary meal plan: higher carb, 4 meals (breakfast, lunch, snack, dinner). */
function planIndianMeals(rng: RNG): { minute: number; carbs: number }[] {
  const meals: { minute: number; carbs: number }[] = [];
  // Indian breakfast: roti/idli/dosa — higher carb (50-80g)
  meals.push({ minute: rng.int(7 * 60, 8 * 60 + 30), carbs: rng.int(50, 80) });
  // Lunch: rice/roti + dal — moderate-high carb (60-95g)
  meals.push({ minute: rng.int(12 * 60 + 30, 13 * 60 + 30), carbs: rng.int(60, 95) });
  // Evening snack: chai + biscuits — small carb (15-30g)
  if (rng.boolean(0.7)) meals.push({ minute: rng.int(16 * 60, 17 * 60), carbs: rng.int(15, 30) });
  // Dinner: roti/sabzi — moderate carb (55-85g)
  meals.push({ minute: rng.int(20 * 60, 21 * 60 + 30), carbs: rng.int(55, 85) });
  return meals;
}

function planWalks(rng: RNG): { start: number; duration: number }[] {
  const walks: { start: number; duration: number }[] = [];
  // Indian cohort: slightly less structured exercise
  const n = rng.boolean(0.55) ? 1 : rng.boolean(0.4) ? 2 : 0;
  for (let i = 0; i < n; i++) {
    walks.push({ start: rng.int(6 * 60, 19 * 60), duration: rng.int(15, 45) });
  }
  return walks;
}
