// ============================================================================
//  Gradient-Boosted Decision Trees (GBDT) — the XGBoost-substitute for GlucoTwin,
//  implemented from scratch in TypeScript.
//
//  - Histogram-based split finding (32 quantile bins per feature) for speed.
//  - Supports binary classification (log loss, Newton leaf updates) and
//    regression (squared loss).
//  - Tree-interpreter (Saabas) local feature contributions for SHAP-style
//    "why" explanations in the margin (log-odds) space.
//  - Entirely serializable to JSON.
// ============================================================================

import { mean, std } from "./stats";

type Node = {
  leaf: boolean;
  value: number; // leaf value (or the value this node would have as a leaf)
  feature?: number;
  threshold?: number; // raw feature threshold for inference (value <= threshold -> left)
  left?: number;
  right?: number;
};

export interface GBDTParams {
  kind: "classification" | "regression";
  nTrees: number;
  maxDepth: number;
  learningRate: number;
  minChildWeight: number;
  l2: number;
  nBins: number;
  // standardization stats (kept for parity with logreg; trees don't need them but
  // we store them so the unified ModelArtifact stays consistent)
  featureMean: number[];
  featureStd: number[];
  // bin edges per feature for inference binning
  binEdges: number[][];
  trees: Node[][];
  init: number; // base margin
}

export class GBDT {
  kind: "classification" | "regression";
  nTrees: number;
  maxDepth: number;
  learningRate: number;
  minChildWeight: number;
  l2: number;
  nBins: number;
  featureMean: number[] = [];
  featureStd: number[] = [];
  binEdges: number[][] = [];
  trees: Node[][] = [];
  init = 0;

  constructor(opts: {
    kind: "classification" | "regression";
    nTrees?: number;
    maxDepth?: number;
    learningRate?: number;
    minChildWeight?: number;
    l2?: number;
    nBins?: number;
  }) {
    this.kind = opts.kind;
    this.nTrees = opts.nTrees ?? 80;
    this.maxDepth = opts.maxDepth ?? 4;
    this.learningRate = opts.learningRate ?? 0.1;
    this.minChildWeight = opts.minChildWeight ?? 10;
    this.l2 = opts.l2 ?? 1.0;
    this.nBins = opts.nBins ?? 32;
  }

  private sigmoid(z: number): number {
    if (z >= 0) return 1 / (1 + Math.exp(-z));
    const e = Math.exp(z);
    return e / (1 + e);
  }

  fit(X: number[][], y: number[]) {
    const n = X.length;
    const d = X[0].length;

    // standardization stats (informational)
    this.featureMean = [];
    this.featureStd = [];
    for (let j = 0; j < d; j++) {
      const col = X.map((r) => r[j]);
      this.featureMean.push(mean(col));
      this.featureStd.push(std(col));
    }

    // build quantile bin edges per feature
    this.binEdges = [];
    for (let j = 0; j < d; j++) {
      const col = X.map((r) => r[j]).sort((a, b) => a - b);
      const edges: number[] = [];
      for (let b = 1; b < this.nBins; b++) {
        const idx = Math.floor((b / this.nBins) * (col.length - 1));
        edges.push(col[idx]);
      }
      this.binEdges.push(edges);
    }
    // precompute binned X
    const binned: Uint8Array[] = [];
    for (let i = 0; i < n; i++) {
      const row = new Uint8Array(d);
      for (let j = 0; j < d; j++) row[j] = this.bin(j, X[i][j]);
      binned.push(row);
    }

    // init margin
    if (this.kind === "classification") {
      const pos = y.reduce((s, v) => s + v, 0);
      const neg = n - pos;
      this.init = Math.log(Math.max(pos, 1) / Math.max(neg, 1));
    } else {
      this.init = mean(y);
    }

    const margin = new Array(n).fill(this.init);

    for (let t = 0; t < this.nTrees; t++) {
      // gradients & hessians
      const grad = new Float64Array(n);
      const hess = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        if (this.kind === "classification") {
          const p = this.sigmoid(margin[i]);
          grad[i] = p - y[i];
          hess[i] = Math.max(p * (1 - p), 1e-6);
        } else {
          grad[i] = margin[i] - y[i];
          hess[i] = 1;
        }
      }
      // fit a tree to (grad, hess)
      const idx = Array.from({ length: n }, (_, k) => k);
      const tree: Node[] = [];
      this.buildTree(binned, grad, hess, idx, 0, tree, d);
      this.trees.push(tree);
      // update margin
      for (let i = 0; i < n; i++) {
        margin[i] += this.learningRate * this.predictTreeRaw(tree, X[i]);
      }
    }
  }

  private bin(feature: number, value: number): number {
    const edges = this.binEdges[feature];
    // binary search the bin
    let lo = 0;
    let hi = edges.length; // bins = edges+1
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (value <= edges[mid]) hi = mid;
      else lo = mid + 1;
    }
    return lo; // 0..edges.length
  }

  private buildTree(
    binned: Uint8Array[],
    grad: Float64Array,
    hess: Float64Array,
    idx: number[],
    depth: number,
    tree: Node[],
    d: number
  ): number {
    const nodeIdx = tree.length;
    const G = idx.reduce((s, i) => s + grad[i], 0);
    const H = idx.reduce((s, i) => s + hess[i], 0);
    const value = -G / (H + this.l2); // Newton leaf value

    if (depth >= this.maxDepth || idx.length < 2 * 4 || H < 2 * this.minChildWeight) {
      tree.push({ leaf: true, value });
      return nodeIdx;
    }

    // histograms per feature: count, gradSum, hessSum per bin
    const nBinsEff = this.nBins; // bins 0..nBins-1 (nBins-1 edges => nBins bins)
    let bestGain = 0;
    let bestFeature = -1;
    let bestBin = -1;

    const parentGain = (G * G) / (H + this.l2);

    for (let f = 0; f < d; f++) {
      const count = new Float64Array(nBinsEff);
      const gSum = new Float64Array(nBinsEff);
      const hSum = new Float64Array(nBinsEff);
      for (const i of idx) {
        const b = binned[i][f];
        count[b]++;
        gSum[b] += grad[i];
        hSum[b] += hess[i];
      }
      // sweep left
      let lCount = 0;
      let lG = 0;
      let lH = 0;
      for (let b = 0; b < nBinsEff - 1; b++) {
        lCount += count[b];
        lG += gSum[b];
        lH += hSum[b];
        if (lCount < 4 || idx.length - lCount < 4) continue;
        if (lH < this.minChildWeight || H - lH < this.minChildWeight) continue;
        const rG = G - lG;
        const rH = H - lH;
        const gain = (lG * lG) / (lH + this.l2) + (rG * rG) / (rH + this.l2) - parentGain;
        if (gain > bestGain) {
          bestGain = gain;
          bestFeature = f;
          bestBin = b;
        }
      }
    }

    if (bestFeature < 0 || bestGain <= 1e-6) {
      tree.push({ leaf: true, value });
      return nodeIdx;
    }

    // reserve slot
    tree.push({ leaf: false, value, feature: bestFeature, threshold: 0, left: -1, right: -1 });
    const rawThreshold = this.binEdges[bestFeature][bestBin];
    tree[nodeIdx].threshold = rawThreshold;

    const leftIdx: number[] = [];
    const rightIdx: number[] = [];
    for (const i of idx) {
      if (binned[i][bestFeature] <= bestBin) leftIdx.push(i);
      else rightIdx.push(i);
    }
    const leftId = this.buildTree(binned, grad, hess, leftIdx, depth + 1, tree, d);
    const rightId = this.buildTree(binned, grad, hess, rightIdx, depth + 1, tree, d);
    tree[nodeIdx].left = leftId;
    tree[nodeIdx].right = rightId;
    return nodeIdx;
  }

  private predictTreeRaw(tree: Node[], x: number[]): number {
    let node = tree[0];
    while (!node.leaf) {
      if (x[node.feature!] <= node.threshold!) node = tree[node.left!];
      else node = tree[node.right!];
    }
    return node.value;
  }

  /** Predict raw margin (sum of trees + init). */
  predictRaw(x: number[]): number {
    let m = this.init;
    for (const tree of this.trees) m += this.learningRate * this.predictTreeRaw(tree, x);
    return m;
  }

  predictProba(x: number[]): number {
    if (this.kind === "classification") return this.sigmoid(this.predictRaw(x));
    return this.predictRaw(x);
  }

  /** Tree-interpreter (Saabas) contributions in margin space. */
  contributions(x: number[]): { feature: number; value: number; contribution: number }[] {
    const d = x.length;
    const contribs = new Array(d).fill(0);
    for (const tree of this.trees) {
      let node = tree[0];
      let prevValue = node.value;
      while (!node.leaf) {
        const child = x[node.feature!] <= node.threshold! ? tree[node.left!] : tree[node.right!];
        contribs[node.feature!] += this.learningRate * (child.value - prevValue);
        prevValue = child.value;
        node = child;
      }
    }
    return x.map((v, j) => ({ feature: j, value: v, contribution: contribs[j] }));
  }

  /** Global feature importance (sum of split gain per feature, normalized). */
  featureImportance(featureNames: string[]): { feature: string; importance: number }[] {
    const gain = new Array(featureNames.length).fill(0);
    for (const tree of this.trees) {
      for (const node of tree) {
        if (!node.leaf && node.feature !== undefined) {
          // approximate gain by |value| weight; we didn't store exact gain, so use
          // child-value variance as a proxy. This is a reasonable importance ranking.
          const l = tree[node.left!];
          const r = tree[node.right!];
          gain[node.feature] += Math.abs(l.value) + Math.abs(r.value);
        }
      }
    }
    const total = gain.reduce((s, v) => s + v, 0) || 1;
    return featureNames
      .map((f, j) => ({ feature: f, importance: gain[j] / total }))
      .sort((a, b) => b.importance - a.importance);
  }

  toJSON(): GBDTParams {
    return {
      kind: this.kind,
      nTrees: this.nTrees,
      maxDepth: this.maxDepth,
      learningRate: this.learningRate,
      minChildWeight: this.minChildWeight,
      l2: this.l2,
      nBins: this.nBins,
      featureMean: this.featureMean,
      featureStd: this.featureStd,
      binEdges: this.binEdges,
      trees: this.trees,
      init: this.init,
    };
  }

  static fromJSON(p: GBDTParams): GBDT {
    const m = new GBDT({ kind: p.kind, nTrees: p.nTrees, maxDepth: p.maxDepth, learningRate: p.learningRate, minChildWeight: p.minChildWeight, l2: p.l2, nBins: p.nBins });
    m.featureMean = p.featureMean;
    m.featureStd = p.featureStd;
    m.binEdges = p.binEdges;
    m.trees = p.trees;
    m.init = p.init;
    return m;
  }
}
