"use client";
// GlucoTwin — doctor dashboard. Single route ("/") with 5 views switched via tabs.
import { useState } from "react";
import { DisclaimerBanner } from "@/components/glucotwin/DisclaimerBanner";
import { PatientListView } from "@/components/glucotwin/PatientListView";
import { DigitalTwinView } from "@/components/glucotwin/DigitalTwinView";
import { WhatIfView } from "@/components/glucotwin/WhatIfView";
import { ModelInsightsView } from "@/components/glucotwin/ModelInsightsView";
import { AboutView } from "@/components/glucotwin/AboutView";
import { Droplet, Users, Activity, FlaskConical, BarChart3, Info, Github } from "lucide-react";
import { cn } from "@/lib/utils";

type View = "patients" | "twin" | "whatif" | "model" | "about";

const NAV: { id: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "patients", label: "Patients", icon: Users },
  { id: "twin", label: "Digital Twin", icon: Activity },
  { id: "whatif", label: "What-if", icon: FlaskConical },
  { id: "model", label: "Model Insights", icon: BarChart3 },
  { id: "about", label: "About", icon: Info },
];

export default function Home() {
  const [view, setView] = useState<View>("patients");
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);

  function selectPatient(id: string) {
    setSelectedPatient(id);
    setView("twin");
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <DisclaimerBanner />

      {/* header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
              <Droplet className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-lg leading-none">GlucoTwin</div>
              <div className="text-[11px] text-muted-foreground leading-none mt-0.5">
                Type 2 Diabetes Digital Twin
              </div>
            </div>
          </div>

          <nav className="ml-auto flex items-center gap-0.5 sm:gap-1 overflow-x-auto">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => setView(n.id)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                  view === n.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <n.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{n.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* main */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-5">
        {view === "patients" && <PatientListView onSelect={selectPatient} />}
        {view === "twin" &&
          (selectedPatient ? (
            <DigitalTwinView
              key={selectedPatient}
              patientId={selectedPatient}
              onOpenWhatIf={() => setView("whatif")}
            />
          ) : (
            <EmptyState
              icon={Users}
              title="No patient selected"
              hint="Go to the Patients tab and pick a virtual patient to view their digital twin."
            />
          ))}
        {view === "whatif" &&
          (selectedPatient ? (
            <WhatIfView key={selectedPatient} patientId={selectedPatient} />
          ) : (
            <EmptyState
              icon={FlaskConical}
              title="No patient selected"
              hint="Pick a patient first to run what-if simulations."
            />
          ))}
        {view === "model" && <ModelInsightsView />}
        {view === "about" && <AboutView />}
      </main>

      {/* footer */}
      <footer className="mt-auto border-t bg-background">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center gap-2 sm:justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Droplet className="h-3.5 w-3.5 text-primary" />
            <span>GlucoTwin · Happiest Health Digital Twin Challenge 2026</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline">Research prototype · synthetic data · not medical advice</span>
            <span className="flex items-center gap-1">
              <Github className="h-3.5 w-3.5" /> MIT License
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
        <Icon className="h-7 w-7" />
      </div>
      <div className="font-semibold">{title}</div>
      <div className="text-sm text-muted-foreground mt-1 max-w-sm">{hint}</div>
    </div>
  );
}
