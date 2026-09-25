// GET /api/patients — list of all virtual patients with their latest risk snapshot.
// Optional query params: ?search=<text>&band=Low|Medium|High&limit=<n>
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";
  const band = searchParams.get("band") || "";
  const limit = parseInt(searchParams.get("limit") || "200", 10);

  const where: any = {};
  if (band && ["Low", "Medium", "High"].includes(band)) {
    where.latestRiskBand = band;
  }
  if (search) {
    where.OR = [
      { id: { contains: search } },
      { name: { contains: search } },
    ];
  }

  const patients = await db.patient.findMany({
    where,
    orderBy: { latestRisk: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      age: true,
      sex: true,
      bmi: true,
      hba1c: true,
      medication: true,
      latestRisk: true,
      latestRiskBand: true,
      latestGlucose: true,
    },
  });

  return NextResponse.json({
    count: patients.length,
    patients: patients.map((p) => ({
      ...p,
      latestRisk: p.latestRisk ?? 0,
      latestRiskBand: p.latestRiskBand ?? "Low",
      latestGlucose: p.latestGlucose ?? 0,
    })),
  });
}
