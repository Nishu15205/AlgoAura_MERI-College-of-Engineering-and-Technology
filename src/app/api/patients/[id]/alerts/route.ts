// GET /api/patients/[id]/alerts — stored risk-alert timeline (last 24h).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const alerts = await db.riskAlert.findMany({
    where: { patientId: id },
    orderBy: { ts: "asc" },
  });
  return NextResponse.json({
    patientId: id,
    alerts: alerts.map((a) => ({
      ts: a.ts,
      tsHuman: a.tsHuman,
      risk: a.risk,
      triggered: a.triggered,
      glucoseAtT: a.glucoseAtT,
      peakGlucose: a.peakGlucose,
    })),
  });
}
