// GET /api/patients/[id]/timeseries — recent CGM + HR + HRV + steps + sleep.
// Optional: ?hours=<n> (default 24). Returns the most recent N hours of stored
// synthetic samples (5-min intervals).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const hours = parseInt(new URL(req.url).searchParams.get("hours") || "24", 10);

  const tail = await db.wearableSample.findMany({
    where: { patientId: id },
    orderBy: { ts: "desc" },
    take: Math.min(hours * 12 + 1, 288 * 3),
  });
  tail.reverse();

  return NextResponse.json({
    patientId: id,
    hours,
    samples: tail.map((s) => ({
      ts: s.ts,
      tsHuman: s.tsHuman,
      glucose: s.glucose,
      heartRate: s.heartRate,
      hrvRmssd: s.hrvRmssd,
      steps: s.steps,
      sleepStage: s.sleepStage,
      mealCarbsG: s.mealCarbsG,
      activityMin: s.activityMin,
    })),
  });
}
