// GET /api/model/metrics — returns the contents of ml/metrics.json
// (ROC-AUC, PR-AUC, F1, confusion matrix, lead time, ROC/PR curves,
//  feature importance, regression MAE).
import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export async function GET() {
  const p = path.join(process.cwd(), "ml", "metrics.json");
  try {
    const raw = fs.readFileSync(p, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "metrics.json not found. Run `bun run build:all` first." },
      { status: 500 }
    );
  }
}
