"use client";
// GuidedTour — a step-by-step tutorial overlay that highlights parts of the
// current view and explains them in plain language. Triggered by "Try Demo"
// buttons on each page. Uses a spotlight + speech-bubble approach.
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronRight, ChevronLeft, X, Sparkles, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TourStep {
  selector: string;        // CSS selector of the element to highlight
  title: string;
  body: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
}

interface GuidedTourProps {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
  tourKey: string;  // unique per view, for localStorage dismissal
}

export function GuidedTour({ steps, open, onClose, tourKey }: GuidedTourProps) {
  if (!open) return null;
  return <GuidedTourInner key={tourKey + (open ? "-open" : "-closed")} steps={steps} open={open} onClose={onClose} tourKey={tourKey} />;
}

function GuidedTourInner({ steps, open, onClose, tourKey }: GuidedTourProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [notFound, setNotFound] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const current = steps[stepIdx];

  const updateHighlight = useCallback(() => {
    if (!open || !current) return;
    const el = document.querySelector(current.selector);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        const r = el.getBoundingClientRect();
        setHighlightRect(r);
        setNotFound(false);
      }, 300);
    } else {
      setTimeout(() => {
        setNotFound(true);
        setHighlightRect(null);
      }, 0);
    }
  }, [open, current]);

  // Update highlight when step changes — deferred to avoid synchronous setState
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => updateHighlight(), 50);
    return () => clearTimeout(id);
  }, [stepIdx, open, current]);

  useEffect(() => {
    if (!open) return;
    const handler = () => updateHighlight();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [open, updateHighlight]);

  if (!current) return null;

  const isLast = stepIdx === steps.length - 1;
  const pos = current.position || "center";

  // tooltip position calculation
  let tooltipStyle: React.CSSProperties = {};
  let effectivePos = pos;
  if (highlightRect && pos !== "center") {
    const margin = 16;
    const tooltipW = 380;
    const tooltipH = 300; // approx height
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    // Check if a position would overflow
    const bottomOverflows = highlightRect.bottom + margin + tooltipH > vh;
    const topOverflows = highlightRect.top - margin - tooltipH < 0;
    const rightOverflows = highlightRect.right + margin + tooltipW > vw;
    const leftOverflows = highlightRect.left - margin - tooltipW < 0;

    // Auto-flip logic with center fallback
    if (pos === "bottom" && bottomOverflows && !topOverflows) {
      effectivePos = "top";
    } else if (pos === "top" && topOverflows && !bottomOverflows) {
      effectivePos = "bottom";
    } else if (pos === "right" && rightOverflows && !leftOverflows) {
      effectivePos = "left";
    } else if (pos === "left" && leftOverflows && !rightOverflows) {
      effectivePos = "right";
    } else if ((pos === "bottom" && bottomOverflows) || (pos === "top" && topOverflows)) {
      // Both top and bottom would overflow — center it
      effectivePos = "center";
    }

    if (effectivePos === "top") {
      tooltipStyle = { top: highlightRect.top - margin, left: highlightRect.left + highlightRect.width / 2, transform: "translate(-50%, -100%)" };
    } else if (effectivePos === "bottom") {
      tooltipStyle = { top: highlightRect.bottom + margin, left: highlightRect.left + highlightRect.width / 2, transform: "translateX(-50%)" };
    } else if (effectivePos === "right") {
      tooltipStyle = { top: highlightRect.top + highlightRect.height / 2, left: highlightRect.right + margin, transform: "translateY(-50%)" };
    } else if (effectivePos === "left") {
      tooltipStyle = { top: highlightRect.top + highlightRect.height / 2, left: highlightRect.left - margin, transform: "translate(-100%, -50%)" };
    } else {
      // center — vertically centered, clamped to safe area
      const safeTop = Math.max(16, Math.min(vh - tooltipH - 16, (vh - tooltipH) / 2));
      tooltipStyle = { top: safeTop, left: vw / 2, transform: "translateX(-50%)" };
    }

    // Clamp horizontal for top/bottom positions
    if (effectivePos === "top" || effectivePos === "bottom") {
      const centerLeft = highlightRect.left + highlightRect.width / 2;
      if (centerLeft - tooltipW / 2 < 16) {
        tooltipStyle.left = tooltipW / 2 + 16;
      } else if (centerLeft + tooltipW / 2 > vw - 16) {
        tooltipStyle.left = vw - tooltipW / 2 - 16;
      }
    }
  }

  const finishTour = () => {
    try { localStorage.setItem(`tour_done_${tourKey}`, "1"); } catch {}
    onClose();
  };

  const skipTour = () => {
    try { localStorage.setItem(`tour_done_${tourKey}`, "1"); } catch {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Dark overlay with cutout */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm transition-all"
        style={{
          clipPath: highlightRect
            ? `polygon(0% 0%, 0% 100%, ${highlightRect.left - 8}px 100%, ${highlightRect.left - 8}px ${highlightRect.top - 8}px, ${highlightRect.right + 8}px ${highlightRect.top - 8}px, ${highlightRect.right + 8}px ${highlightRect.bottom + 8}px, ${highlightRect.left - 8}px ${highlightRect.bottom + 8}px, ${highlightRect.left - 8}px 100%, 100% 100%, 100% 0%)`
            : "none",
        }}
      />

      {/* Highlight ring */}
      {highlightRect && !notFound && (
        <div
          className="absolute ring-4 ring-amber-400 ring-offset-2 ring-offset-transparent rounded-lg pointer-events-none animate-pulse"
          style={{
            top: highlightRect.top - 8,
            left: highlightRect.left - 8,
            width: highlightRect.width + 16,
            height: highlightRect.height + 16,
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className={cn(
          "absolute pointer-events-auto z-[101]",
          !highlightRect || pos === "center" || notFound ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" : ""
        )}
        style={highlightRect && pos !== "center" && !notFound ? tooltipStyle : {}}
      >
        <Card className="w-[340px] sm:w-[380px] shadow-2xl border-amber-300 bg-white relative overflow-hidden">
          {/* gradient header strip */}
          <div className="h-1.5 bg-gradient-to-r from-teal-500 via-amber-400 to-teal-500" />
          <div className="p-5">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-teal-500 to-amber-400 flex items-center justify-center text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
                  Step {stepIdx + 1} of {steps.length}
                </div>
              </div>
              <button onClick={skipTour} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <h3 className="font-bold text-base text-slate-900 mb-1.5">{current.title}</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">{current.body}</p>

            {notFound && (
              <div className="mb-3 text-xs text-amber-600 bg-amber-50 rounded-md p-2">
                (Scroll down if you don't see this element — it may be below the fold.)
              </div>
            )}

            {/* progress dots */}
            <div className="flex items-center gap-1 mb-4">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === stepIdx ? "w-6 bg-amber-400" : i < stepIdx ? "w-1.5 bg-teal-500" : "w-1.5 bg-slate-200"
                  )}
                />
              ))}
            </div>

            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                disabled={stepIdx === 0}
                className="text-xs"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              {isLast ? (
                <Button size="sm" onClick={finishTour} className="bg-gradient-to-r from-teal-600 to-teal-500 text-white">
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Got it!
                </Button>
              ) : (
                <Button size="sm" onClick={() => setStepIdx((i) => Math.min(steps.length - 1, i + 1))} className="bg-gradient-to-r from-teal-600 to-teal-500 text-white">
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

/** A floating "How to Use" button that triggers the tour. */
export function TryDemoButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      size="sm"
      variant="outline"
      className="border-slate-300 text-slate-700 hover:bg-slate-50"
    >
      How to Use
    </Button>
  );
}

/** Hook to manage tour state with localStorage dismissal. */
export function useTour(tourKey: string) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(`tour_done_${tourKey}`) === "1");
    } catch {}
  }, [tourKey]);

  const start = () => setOpen(true);
  const close = () => setOpen(false);

  return { open, start, close, dismissed };
}
