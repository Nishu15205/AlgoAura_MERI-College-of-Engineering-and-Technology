// POST /api/patients/[id]/whatif — run a what-if simulation.
// Body: { carbs_g, walk_minutes, sleep_hours, skip_medication }
// Returns baseline vs simulated glucose curves and the change in spike risk.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { simulateWhatIf, type WhatIfAction, type CurrentState } from "@/lib/ml/twin-simulator";
import { predictRisk } from "@/lib/ml/predict";
import type { EhrRecord, WearableSample } from "@/lib/ml/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action: WhatIfAction = {
    carbsG: Number(body.carbs_g) || 0,
    walkMinutes: Number(body.walk_minutes) || 0,
    sleepHours: Number(body.sleep_hours) || 7,
    skipMedication: Boolean(body.skip_medication),
  };

  const patient = await db.patient.findUnique({ where: { id } });
  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const rows = await db.wearableSample.findMany({
    where: { patientId: id },
    orderBy: { ts: "desc" },
    take: 96,
  });
  rows.reverse();

  const ehr: EhrRecord = {
    patientId: patient.id,
    name: patient.name,
    age: patient.age,
    sex: patient.sex as "male" | "female",
    bmi: patient.bmi,
    hba1c: patient.hba1c,
    yearsSinceDiagnosis: patient.yearsSinceDiagnosis,
    medication: patient.medication as EhrRecord["medication"],
    hypertension: patient.hypertension as 0 | 1,
    familyHistoryDiabetes: patient.familyHistoryDiabetes as 0 | 1,
    geneticRiskScore: patient.geneticRiskScore,
    fastingGlucose: patient.fastingGlucose,
    egfr: patient.egfr,
  };
  const samples: WearableSample[] = rows.map((s) => ({
    patientId: s.patientId,
    ts: s.ts,
    tsHuman: s.tsHuman,
    glucose: s.glucose,
    heartRate: s.heartRate,
    hrvRmssd: s.hrvRmssd,
    steps: s.steps,
    sleepStage: s.sleepStage as WearableSample["sleepStage"],
    mealCarbsG: s.mealCarbsG,
    activityMin: s.activityMin,
  }));

  // current state for the simulator
  const last = samples[samples.length - 1];
  const roc60 = samples.length > 12 ? last.glucose - samples[samples.length - 13].glucose : 0;
  const lastDate = new Date(last.ts * 1000);
  const minuteOfDay = lastDate.getUTCHours() * 60 + lastDate.getUTCMinutes();

  const currentState: CurrentState = {
    glucose: last.glucose,
    minuteOfDay,
    recentRoc60: roc60,
    dayBaseline: ehr.fastingGlucose,
  };

  // baseline risk from the ML model
  const pred = predictRisk(samples, ehr);
  const baselineRiskProb = pred?.probability ?? 0.3;

  const result = simulateWhatIf(ehr, currentState, action, baselineRiskProb);

  return NextResponse.json({
    patientId: id,
    action,
    ...result,
  });
}
