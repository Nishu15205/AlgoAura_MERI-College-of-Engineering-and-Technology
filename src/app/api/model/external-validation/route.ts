// GET /api/model/external-validation — returns the external cohort validation results.
import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export async function GET() {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), "ml", "external-validation.json"), "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json(
      { error: "external-validation.json not found. Run `bun run scripts/validate-external-cohort.ts` first." },
      { status: 500 }
    );
  }
}
