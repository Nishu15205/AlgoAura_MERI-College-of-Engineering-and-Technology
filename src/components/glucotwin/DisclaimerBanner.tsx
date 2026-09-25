// A persistent disclaimer banner shown at the top of the app.
import { ShieldAlert } from "lucide-react";

export function DisclaimerBanner() {
  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 text-amber-800 text-xs sm:text-sm">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span>
          <strong>Research prototype.</strong> Uses fully synthetic data.{" "}
          <strong>Not medical advice.</strong> Do not use for clinical decisions.
        </span>
      </div>
    </div>
  );
}
