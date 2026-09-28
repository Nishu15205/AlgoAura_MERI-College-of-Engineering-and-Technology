"use client";
// GlucoTwin — clean, professional medical dashboard. Human-made design.
import { useState } from "react";
import { DisclaimerBanner } from "@/components/glucotwin/DisclaimerBanner";
import { PatientListView } from "@/components/glucotwin/PatientListView";
import { DigitalTwinView } from "@/components/glucotwin/DigitalTwinView";
import { WhatIfView } from "@/components/glucotwin/WhatIfView";
import { ModelInsightsView } from "@/components/glucotwin/ModelInsightsView";
import { AboutView } from "@/components/glucotwin/AboutView";
import { GuidedTour, TryDemoButton, useTour, type TourStep } from "@/components/glucotwin/GuidedTour";
import {
  PATIENT_LIST_TOUR, DIGITAL_TWIN_TOUR, WHATIF_TOUR,
  MODEL_INSIGHTS_TOUR, ABOUT_TOUR,
} from "@/components/glucotwin/tour-steps";
import { Droplet, Users, Activity, FlaskConical, BarChart3, Info, Github, Heart, Play } from "lucide-react";
import { GlucoseCurveIllustration } from "@/components/glucotwin/Illustrations";
import { cn } from "@/lib/utils";

type View = "patients" | "twin" | "whatif" | "model" | "about";

const NAV: { id: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "patients", label: "Patients", icon: Users },
  { id: "twin", label: "Digital Twin", icon: Activity },
  { id: "whatif", label: "What-if", icon: FlaskConical },
  { id: "model", label: "Insights", icon: BarChart3 },
  { id: "about", label: "About", icon: Info },
];

export default function Home() {
  const [view, setView] = useState<View>("patients");
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const tour = useTour(`view-${view}`);

  function selectPatient(id: string) {
    setSelectedPatient(id);
    setView("twin");
  }

  const tourSteps: Record<View, TourStep[]> = {
    patients: PATIENT_LIST_TOUR,
    twin: DIGITAL_TWIN_TOUR,
    whatif: WHATIF_TOUR,
    model: MODEL_INSIGHTS_TOUR,
    about: ABOUT_TOUR,
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <DisclaimerBanner />

      {/* Clean solid header — no blur, no gradient spam */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          {/* Logo — simple, solid */}
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-teal-600 flex items-center justify-center text-white">
              <Droplet className="h-5 w-5" fill="currentColor" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-[15px] leading-none text-slate-900">GlucoTwin</span>
              <span className="text-[10px] text-slate-500 leading-none mt-0.5">Diabetes Digital Twin</span>
            </div>
          </div>

          {/* Nav — underline style, not gradient pills */}
          <nav className="ml-auto flex items-center gap-0.5">
            {NAV.map((n) => {
              const active = view === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setView(n.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    active
                      ? "bg-teal-50 text-teal-700"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  )}
                >
                  <n.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{n.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="ml-2">
            <TryDemoButton onClick={tour.start} />
          </div>
        </div>
      </header>

      {/* Hero — content + custom SVG illustration */}
      {view === "patients" && (
        <section className="bg-white border-b border-slate-200 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 py-10 sm:py-14">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              {/* Left: content */}
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-full px-2.5 py-0.5 mb-4">
                  <Heart className="h-3 w-3" />
                  Happiest Health Digital Twin Challenge 2026
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight tracking-tight mb-3">
                  Predict glucose spikes{" "}
                  <span className="text-teal-600">2 hours</span> before they happen.
                </h1>
                <p className="text-slate-600 text-base leading-relaxed mb-6 max-w-xl">
                  A digital twin that fuses synthetic EHR and wearable data to forecast glucose spikes, explain the risk, and let doctors rehearse interventions — before they're needed.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => document.querySelector('tbody tr')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    className="bg-teal-600 text-white font-medium px-4 py-2 rounded-lg text-sm hover:bg-teal-700 transition-colors flex items-center gap-1.5"
                  >
                    <Play className="h-3.5 w-3.5" fill="currentColor" /> Explore Patients
                  </button>
                  <div className="flex items-center gap-5 ml-2">
                    <Stat value="200" label="Patients" />
                    <Stat value="0.981" label="ROC-AUC" />
                    <Stat value="75m" label="Lead time" />
                  </div>
                </div>
              </div>

              {/* Right: custom animated SVG illustration */}
              <div className="relative">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-rose-400" />
                      <span className="text-xs font-medium text-slate-600">Live glucose forecast</span>
                    </div>
                    <span className="text-xs text-slate-400">next 2 hours</span>
                  </div>
                  <GlucoseCurveIllustration className="w-full h-auto" />
                  <div className="flex items-center gap-4 mt-3 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-3 rounded-sm bg-teal-500" /> History
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-3 rounded-sm bg-sky-500 opacity-60" /> Prediction
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500" /> Meals
                    </span>
                    <span className="flex items-center gap-1.5 ml-auto">
                      <span className="h-0.5 w-3 bg-rose-500" /> 180 threshold
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* main */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {view === "patients" && <PatientListView onSelect={selectPatient} />}
        {view === "twin" &&
          (selectedPatient ? (
            <DigitalTwinView
              key={selectedPatient}
              patientId={selectedPatient}
              onOpenWhatIf={() => setView("whatif")}
            />
          ) : (
            <EmptyState icon={Users} title="No patient selected" hint="Go to the Patients tab and pick a virtual patient to view their digital twin." />
          ))}
        {view === "whatif" &&
          (selectedPatient ? (
            <WhatIfView key={selectedPatient} patientId={selectedPatient} />
          ) : (
            <EmptyState icon={FlaskConical} title="No patient selected" hint="Pick a patient first to run what-if simulations." />
          ))}
        {view === "model" && <ModelInsightsView />}
        {view === "about" && <AboutView />}
      </main>

      {/* footer — clean solid */}
      <footer className="mt-auto bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center gap-2 sm:justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Droplet className="h-3.5 w-3.5 text-teal-600" fill="currentColor" />
            <span className="font-medium text-slate-700">GlucoTwin · Team AlgoAura · MERI College</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline">Research prototype · synthetic data · not medical advice</span>
            <span className="flex items-center gap-1">
              <Github className="h-3.5 w-3.5" /> MIT License
            </span>
          </div>
        </div>
      </footer>

      <GuidedTour steps={tourSteps[view]} open={tour.open} onClose={tour.close} tourKey={`view-${view}`} />
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint }: { icon: React.ComponentType<{ className?: string }>; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-14 w-14 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
        <Icon className="h-7 w-7" />
      </div>
      <div className="font-semibold text-slate-900">{title}</div>
      <div className="text-sm text-slate-500 mt-1 max-w-sm">{hint}</div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-lg font-bold text-slate-900 leading-none">{value}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
