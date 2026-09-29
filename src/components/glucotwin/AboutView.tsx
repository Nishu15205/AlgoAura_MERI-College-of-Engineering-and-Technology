"use client";
// About / Architecture view — explains the system, shows a data-flow diagram,
// the tech stack, and the synthetic-data + not-medical-advice disclaimers.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  Cpu,
  Brain,
  Server,
  MonitorSmartphone,
  GitBranch,
  ShieldAlert,
  ArrowRight,
  Layers,
} from "lucide-react";

export function AboutView() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> Architecture & data flow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row items-stretch gap-2 overflow-x-auto pb-2">
            <FlowNode icon={Database} title="Synthetic data" subtitle="200 patients · 14d CGM" tint="text-teal-600 bg-teal-50" />
            <Arrow />
            <FlowNode icon={GitBranch} title="Feature fusion" subtitle="6h CGM + EHR (33 feats)" tint="text-violet-600 bg-violet-50" />
            <Arrow />
            <FlowNode icon={Brain} title="Train" subtitle="LogReg + GBDT" tint="text-amber-600 bg-amber-50" />
            <Arrow />
            <FlowNode icon={Cpu} title="Model artifacts" subtitle="JSON in ml/" tint="text-rose-600 bg-rose-50" />
            <Arrow />
            <FlowNode icon={Server} title="API routes" subtitle="Next.js handlers" tint="text-sky-600 bg-sky-50" />
            <Arrow />
            <FlowNode icon={MonitorSmartphone} title="Doctor dashboard" subtitle="React + Recharts" tint="text-emerald-600 bg-emerald-50" />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            A parallel <strong>twin simulator</strong> (physiological model) powers the what-if
            view, and an <strong>SSE stream</strong> replays wearable data for the live-replay toggle.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">How the digital twin works</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              A <strong>digital twin</strong> is a live, data-driven model of a patient. GlucoTwin
              builds one by fusing two data streams:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Static EHR</strong> — age, BMI, HbA1c, medication, genetics, kidney function.</li>
              <li><strong>Dynamic wearables</strong> — CGM glucose, heart rate, HRV, steps, sleep, meals.</li>
            </ul>
            <p>
              Every 5 minutes the model recomputes a 33-feature snapshot and predicts the chance of a
              glucose spike (&gt;180 mg/dL) in the next 2 hours, plus the future glucose curve. The
              twin simulator then lets a clinician ask &quot;what if the patient eats 60g carbs and
              walks 20 minutes?&quot; and compares the resulting glucose trajectory.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tech stack</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {["Next.js 16", "TypeScript", "Tailwind CSS", "shadcn/ui", "Recharts", "lucide-react", "Prisma", "SQLite"].map((t) => (
                <Badge key={t} variant="secondary">{t}</Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              The ML models (logistic regression + histogram gradient-boosted trees) are implemented
              from scratch in TypeScript — no Python runtime required for the demo.
            </p>
            <p className="text-xs text-muted-foreground">
              Originally specced as Python/FastAPI + React/Vite; implemented as a single Next.js app
              for the live demo environment, with a 1:1 mapping of every required component.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-amber-800">
            <ShieldAlert className="h-4 w-4" /> Disclaimers & honest limitations
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-amber-900/90 space-y-1.5">
          <p>This is a <strong>research prototype</strong> built for the Happiest Health Digital Twin Challenge 2026.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>All patient data is <strong>fully synthetic</strong>, generated by our own script with a fixed random seed. No real patient data is used (DPDP/HIPAA compliant by construction).</li>
            <li>The model is <strong>not clinically validated</strong> and must not be used for diagnosis, treatment, or dosing decisions.</li>
            <li>The twin simulator uses a simplified physiological model, not a validated glucose kinetics engine.</li>
            <li>Metrics reflect performance on synthetic data only; real-world performance will differ.</li>
            <li>SHAP-style reasons are tree-interpreter approximations in log-odds space.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 text-xs text-muted-foreground font-mono">
          <div className="text-muted-foreground mb-1">Reproduce everything:</div>
          <div>bun install</div>
          <div>bun run db:push</div>
          <div>bun run build:all <span className="text-muted-foreground/60"># ~15s: data + train + seed</span></div>
          <div>bun run dev</div>
        </CardContent>
      </Card>
    </div>
  );
}

function FlowNode({
  icon: Icon,
  title,
  subtitle,
  tint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  tint: string;
}) {
  return (
    <div className="flex-1 min-w-[140px] rounded-lg border bg-card p-3 flex flex-col items-center text-center gap-1">
      <div className={`p-2 rounded-md ${tint}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-sm font-semibold mt-1">{title}</div>
      <div className="text-[10px] text-muted-foreground leading-tight">{subtitle}</div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center justify-center text-muted-foreground">
      <ArrowRight className="h-5 w-5 rotate-90 lg:rotate-0" />
    </div>
  );
}
