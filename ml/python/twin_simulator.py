"""
GlucoTwin — Twin Simulator (Python)
Physiological what-if model: meal, walk, sleep, medication.
Given current state + action, simulates 3 hours of glucose.

Run: python ml/python/twin_simulator.py
"""
import numpy as np

def simulate(current_glucose, baseline, carbs_g=0, walk_min=0, sleep_hours=7,
             skip_med=False, insulin_sensitivity=0.5, med_boost=0.18, med_red=0.15,
             hba1c=7.5, n_steps=36, step_min=5):
    if skip_med:
        med_boost = 0; med_red = 0
        insulin_sensitivity = max(0.2, insulin_sensitivity - 0.1)
    sleep_adj = np.clip((7 - sleep_hours) * 4, -8, 16)
    base = baseline + sleep_adj
    glucose = current_glucose
    gut = carbs_g
    absorption_rate = 0.07
    carb_to_g = (1.7 * (1 - med_red)) / insulin_sensitivity
    clearance = (0.05 + med_boost) * insulin_sensitivity

    baseline_curve = []
    whatif_curve = []

    for step in range(n_steps + 1):
        t = step * step_min
        # Baseline (no action)
        b_gut = 0  # no meal in baseline
        b_abs = b_gut * absorption_rate
        b_clear = (glucose - base) * clearance * 0.8  # slightly different
        b_g = glucose + 0 - b_clear + np.random.normal(0, 1)
        baseline_curve.append({"t": t, "glucose": round(b_g, 1)})

        # What-if
        w_abs = gut * absorption_rate
        gut = max(0, gut - w_abs)
        d_gut = w_abs * carb_to_g
        d_clear = (glucose - base) * clearance
        hour = ((t + 12*60) / 60) % 24  # approximate
        d_dawn = (hba1c - 6.5) * 0.7 * (1 - abs(hour - 6) / 2) if 4 <= hour < 8 else 0
        d_ex = -step_min * (0.35 + 0.2 * (1 - insulin_sensitivity)) if 15 <= t < 15 + walk_min else 0
        glucose = glucose + d_gut - d_clear + d_dawn + d_ex + np.random.normal(0, 1.5)
        glucose = max(40, min(400, glucose))
        whatif_curve.append({"t": t, "glucose": round(glucose, 1)})

    return {
        "baseline": baseline_curve,
        "whatif": whatif_curve,
        "baseline_peak": max(p["glucose"] for p in baseline_curve),
        "whatif_peak": max(p["glucose"] for p in whatif_curve),
    }

if __name__ == "__main__":
    result = simulate(current_glucose=200, baseline=160, carbs_g=60, walk_min=20)
    print(f"Baseline peak: {result['baseline_peak']:.0f} mg/dL")
    print(f"What-if peak: {result['whatif_peak']:.0f} mg/dL")
    print(f"Baseline curve: {result['baseline'][:5]}...")
    print(f"What-if curve: {result['whatif'][:5]}...")
