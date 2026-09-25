// GET /api/model/calibration — returns the calibration curve + ECE.
import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export async function GET() {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "ml", "metrics.json"), "utf-8");
    const m = JSON.parse(raw);
    return NextResponse.json({
      ece: m.calibration?.ece ?? 0,
      curve: m.calibration?.curve ?? [],
      plattA: m.calibration?.plattA ?? 1,
      plattB: m.calibration?.plattB ?? 0,
      crossValidation: m.crossValidation ?? null,
    });
  } catch {
    return NextResponse.json({ error: "metrics.json not found" }, { status: 500 });
  }
}
