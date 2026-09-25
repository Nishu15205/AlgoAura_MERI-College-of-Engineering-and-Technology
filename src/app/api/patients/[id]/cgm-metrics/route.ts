// GET /api/patients/[id]/cgm-metrics — standard AGP/CGM metrics (TIR, TAR, TBR,
// GMI, CV) for the patient's recent glucose history.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeCgmMetrics, cgmMetricsToList } from "@/lib/ml/cgm-metrics";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rows = await db.wearableSample.findMany({
    where: { patientId: id },
    orderBy: { ts: "desc" },
    take: 288 * 3, // last 3 days
  });
  rows.reverse();
  const glucose = rows.map((r) => r.glucose);
  const metrics = computeCgmMetrics(glucose);
  return NextResponse.json({
    patientId: id,
    windowDays: 3,
    nSamples: glucose.length,
    metrics,
    list: cgmMetricsToList(metrics),
  });
}
