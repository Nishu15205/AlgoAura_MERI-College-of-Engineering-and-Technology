// GET /api/patients/[id]/risk — spike probability, predicted glucose curve,
// and top SHAP-style reasons for the patient's latest state.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { predictRisk } from "@/lib/ml/predict";
import type { EhrRecord, WearableSample } from "@/lib/ml/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const patient = await db.patient.findUnique({ where: { id } });
  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  // Load enough samples for a full 6-hour lookback (72 samples) + a buffer.
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

  const prediction = predictRisk(samples, ehr);
  if (!prediction) {
    return NextResponse.json(
      { error: "Not enough history yet" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    patientId: id,
    currentGlucose: samples[samples.length - 1].glucose,
    timestamp: samples[samples.length - 1].tsHuman,
    ...prediction,
  });
}
