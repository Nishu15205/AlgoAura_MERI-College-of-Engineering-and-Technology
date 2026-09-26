// GET /api/patients — list of all virtual patients with their latest risk snapshot.
// Auto-seeds DB if empty (fixes data disappearing on environment reset).
// Optional query params: ?search=<text>&band=Low|Medium|High&limit=<n>
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureData } from "@/lib/auto-seed";

// Auto-seed on first call if DB empty
let seeded = false;
async function autoSeed() {
  if (seeded) return;
  try {
    const count = await db.patient.count();
    if (count === 0) {
      console.log("[patients] DB empty, triggering auto-seed...");
      const { execSync } = await import("child_process");
      try {
        execSync("bun run build:all", { stdio: "pipe", timeout: 120000, cwd: process.cwd() });
        console.log("[patients] Auto-seed complete.");
      } catch (e) {
        console.error("[patients] Auto-seed failed:", e.message?.slice(0, 200));
      }
    }
    seeded = true;
  } catch (e) {
    // DB might not exist — try to initialize
    console.log("[patients] DB error, initializing...");
    const { execSync } = await import("child_process");
    try {
      execSync("bun run db:push", { stdio: "pipe", timeout: 30000, cwd: process.cwd() });
      execSync("bun run build:all", { stdio: "pipe", timeout: 120000, cwd: process.cwd() });
    } catch (e2) {
      console.error("[patients] Init failed:", e2.message?.slice(0, 200));
    }
    seeded = true;
  }
}

export async function GET(req: NextRequest) {
  await autoSeed();

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
