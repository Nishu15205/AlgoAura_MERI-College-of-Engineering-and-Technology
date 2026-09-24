// GET /api/health — simple health check.
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "GlucoTwin API",
    time: new Date().toISOString(),
    version: "1.0.0",
  });
}
