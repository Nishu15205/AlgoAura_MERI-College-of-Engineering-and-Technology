"use client";
// EHR panel — shows the patient's static clinical record.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EhrPatient } from "./types";
import { FileText, HeartPulse, Dna, Pill } from "lucide-react";

export function EhrPanel({ patient }: { patient: EhrPatient }) {
  const fields = [
    { label: "Age", value: `${patient.age} yrs` },
    { label: "Sex", value: patient.sex },
    { label: "BMI", value: patient.bmi.toFixed(1) },
    { label: "HbA1c", value: `${patient.hba1c}%` },
    { label: "Years diagnosed", value: `${patient.yearsSinceDiagnosis}` },
    { label: "Fasting glucose", value: `${Math.round(patient.fastingGlucose)} mg/dL` },
    { label: "eGFR", value: `${Math.round(patient.egfr)}` },
    { label: "Hypertension", value: patient.hypertension ? "Yes" : "No" },
    { label: "Family history", value: patient.familyHistoryDiabetes ? "Yes" : "No" },
    { label: "Genetic risk", value: `${Math.round(patient.geneticRiskScore * 100)}%` },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          EHR Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Pill className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Medication:</span>
          <span className="font-medium">{patient.medication}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <HeartPulse className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Blood pressure:</span>
          <span className="font-medium">
            {patient.hypertension ? "Hypertensive" : "Normal"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Dna className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Genetic risk:</span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${patient.geneticRiskScore * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium w-8 text-right">
            {Math.round(patient.geneticRiskScore * 100)}%
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          {fields.map((f) => (
            <div key={f.label} className="bg-muted/40 rounded-md px-2.5 py-1.5">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {f.label}
              </div>
              <div className="text-sm font-medium">{f.value}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
