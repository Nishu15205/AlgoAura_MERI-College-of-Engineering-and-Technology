// Small statistics helpers used across feature engineering and evaluation.

export function mean(x: number[]): number {
  if (x.length === 0) return 0;
  let s = 0;
  for (const v of x) s += v;
  return s / x.length;
}

export function std(x: number[]): number {
  if (x.length < 2) return 0;
  const m = mean(x);
  let s = 0;
  for (const v of x) s += (v - m) * (v - m);
  return Math.sqrt(s / (x.length - 1));
}

export function sum(x: number[]): number {
  let s = 0;
  for (const v of x) s += v;
  return s;
}

export function minVal(x: number[]): number {
  let m = Infinity;
  for (const v of x) if (v < m) m = v;
  return x.length ? m : 0;
}

export function maxVal(x: number[]): number {
  let m = -Infinity;
  for (const v of x) if (v > m) m = v;
  return x.length ? m : 0;
}

export function quantile(x: number[], q: number): number {
  if (x.length === 0) return 0;
  const sorted = x.slice().sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

/** Standardize a column using given mean/std (used at inference with training stats). */
export function standardize(value: number, mu: number, sigma: number): number {
  return sigma > 1e-9 ? (value - mu) / sigma : 0;
}

/** Linear interpolation. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp. */
export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
