// Auto-seed: runs on first API call if DB is empty. Ensures data never disappears.
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const db = new PrismaClient({ log: ["error"] });
let seeding = false;

export async function ensureData() {
  try {
    const count = await db.patient.count();
    if (count === 0 && !seeding) {
      seeding = true;
      console.log("[auto-seed] DB empty. Seeding...");
      // Check if ml artifacts exist
      const mlDir = path.join(process.cwd(), "ml");
      const dbPath = path.join(process.cwd(), "db", "custom.db");
      
      // If ml artifacts missing, run full build
      if (!fs.existsSync(path.join(mlDir, "gbdt-classification.json"))) {
        console.log("[auto-seed] ML artifacts missing. Running build:all...");
        try {
          execSync("bun run build:all", { stdio: "pipe", timeout: 120000, cwd: process.cwd() });
        } catch (e) {
          console.error("[auto-seed] build:all failed:", e.message?.slice(0, 200));
        }
      } else {
        // ML exists but DB empty — just re-seed DB from build-all
        console.log("[auto-seed] ML exists, re-seeding DB only...");
        try {
          execSync("bun run build:all", { stdio: "pipe", timeout: 120000, cwd: process.cwd() });
        } catch (e) {
          console.error("[auto-seed] re-seed failed:", e.message?.slice(0, 200));
        }
      }
      seeding = false;
    }
  } catch (e) {
    seeding = false;
    // DB might not exist yet — run db:push + build:all
    console.log("[auto-seed] DB error, initializing...");
    try {
      execSync("bun run db:push", { stdio: "pipe", timeout: 30000, cwd: process.cwd() });
      execSync("bun run build:all", { stdio: "pipe", timeout: 120000, cwd: process.cwd() });
    } catch (e2) {
      console.error("[auto-seed] init failed:", e2.message?.slice(0, 200));
    }
  } finally {
    await db.$disconnect();
  }
}
