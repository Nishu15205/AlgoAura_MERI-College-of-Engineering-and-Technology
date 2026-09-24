// Seeded random number generator for reproducible synthetic data + model training.
// Using mulberry32 (fast, good enough quality for a research prototype) + a gaussian helper.
// Fixed seed => every run of the pipeline produces identical patients, wearables and model.

/** Mulberry32 PRNG — returns a function producing floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A small RNG bundle: uniform, int, gaussian, pick, shuffle. */
export class RNG {
  private next: () => number;
  constructor(seed: number) {
    this.next = mulberry32(seed);
  }
  /** Uniform float in [min, max). */
  uniform(min = 0, max = 1): number {
    return min + (max - min) * this.next();
  }
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.uniform(min, max + 1));
  }
  /** Standard normal via Box-Muller. */
  gaussian(mean = 0, std = 1): number {
    const u1 = Math.max(this.next(), 1e-12);
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + std * z;
  }
  /** Pick a random element. */
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  /** True with probability p. */
  boolean(p = 0.5): boolean {
    return this.next() < p;
  }
  /** Fisher-Yates shuffle (returns a new array). */
  shuffle<T>(arr: T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}

// Global fixed seed — change here to re-randomize the whole pipeline.
export const GLOBAL_SEED = 20260117;
