// ============================================================================
//  Random Forest classifier — a bagged ensemble of decision trees with bootstrap
//  sampling and random feature subsampling, for a 3-way model comparison
//  (Logistic Regression vs GBDT vs Random Forest). Built on the same histogram
//  tree builder as the GBDT for speed and consistency.
// ============================================================================

import { GBDT } from "./gbdt";
import { mean } from "./stats";
import { RNG } from "./rng";

export interface RandomForestParams {
  nTrees: number;
  maxDepth: number;
  minChildWeight: number;
  l2: number;
  nBins: number;
  featureSampleFrac: number; // fraction of features per tree (typical: sqrt(d))
  featureMean: number[];
  featureStd: number[];
  binEdges: number[][];
  // each tree is a standalone GBDT-with-1-tree (reuses the builder + feature subset mask)
  trees: {
    nodes: any[];
    featureMask: number[];
  }[];
}

export class RandomForest {
  nTrees: number;
  maxDepth: number;
  minChildWeight: number;
  l2: number;
  nBins: number;
  featureSampleFrac: number;
  featureMean: number[] = [];
  featureStd: number[] = [];
  binEdges: number[][] = [];
  trees: { nodes: any[]; featureMask: number[] }[] = [];

  constructor(opts: {
    nTrees?: number;
    maxDepth?: number;
    minChildWeight?: number;
    l2?: number;
    nBins?: number;
    featureSampleFrac?: number;
  } = {}) {
    this.nTrees = opts.nTrees ?? 60;
    this.maxDepth = opts.maxDepth ?? 6;
    this.minChildWeight = opts.minChildWeight ?? 5;
    this.l2 = opts.l2 ?? 1.0;
    this.nBins = opts.nBins ?? 32;
    this.featureSampleFrac = opts.featureSampleFrac ?? 0.5;
  }

  private sigmoid(z: number): number {
    if (z >= 0) return 1 / (1 + Math.exp(-z));
    const e = Math.exp(z);
    return e / (1 + e);
  }

  fit(X: number[][], y: number[], seed = 42) {
    const n = X.length;
    const d = X[0].length;
    const rng = new RNG(seed);

    // standardization stats
    this.featureMean = [];
    this.featureStd = [];
    for (let j = 0; j < d; j++) {
      const col = X.map((r) => r[j]);
      this.featureMean.push(mean(col));
      const m = mean(col);
      let s = 0;
      for (const v of col) s += (v - m) * (v - m);
      this.featureStd.push(Math.sqrt(s / Math.max(1, col.length - 1)));
    }

    // bin edges (shared across trees, computed once on the full data)
    this.binEdges = [];
    for (let j = 0; j < d; j++) {
      const col = X.map((r) => r[j]).sort((a, b) => a - b);
      const edges: number[] = [];
      for (let b = 1; b < this.nBins; b++) {
        edges.push(col[Math.floor((b / this.nBins) * (col.length - 1))]);
      }
      this.binEdges.push(edges);
    }

    const nFeaturesPerTree = Math.max(1, Math.round(d * this.featureSampleFrac));
    this.trees = [];

    for (let t = 0; t < this.nTrees; t++) {
      // bootstrap sample (with replacement)
      const idx: number[] = [];
      for (let i = 0; i < n; i++) idx.push(rng.int(0, n - 1));
      const Xb = idx.map((i) => X[i]);
      const yb = idx.map((i) => y[i]);

      // random feature subset
      const allFeatures = Array.from({ length: d }, (_, k) => k);
      const shuffled = rng.shuffle(allFeatures);
      const featureMask = shuffled.slice(0, nFeaturesPerTree).sort((a, b) => a - b);

      // build a single tree on (Xb, yb) with the feature subset, using a
      // classification GBDT with 1 tree as the builder (reuses histogram code)
      const baseG = new GBDT({
        kind: "classification",
        nTrees: 1,
        maxDepth: this.maxDepth,
        learningRate: 1,
        minChildWeight: this.minChildWeight,
        l2: this.l2,
        nBins: this.nBins,
      });
      // HACK: restrict features by zeroing-out non-selected columns in a copy
      const XbSub = Xb.map((r) => {
        const copy = r.slice();
        for (let j = 0; j < d; j++) if (!featureMask.includes(j)) copy[j] = 0;
        return copy;
      });
      baseG.fit(XbSub, yb);
      this.trees.push({ nodes: baseG.trees[0], featureMask });
    }
  }

  predictProba(x: number[]): number {
    // average probability across trees
    let p = 0;
    for (const tree of this.trees) {
      // zero out non-selected features for this tree
      const xSub = x.slice();
      for (let j = 0; j < x.length; j++) if (!tree.featureMask.includes(j)) xSub[j] = 0;
      // walk the tree
      let node = tree.nodes[0];
      while (!node.leaf) {
        if (xSub[node.feature!] <= node.threshold!) node = tree.nodes[node.left!];
        else node = tree.nodes[node.right!];
      }
      // node.value is the Newton leaf value (log-odds); convert to proba
      p += this.sigmoid(node.value);
    }
    return p / this.trees.length;
  }

  toJSON(): RandomForestParams {
    return {
      nTrees: this.nTrees,
      maxDepth: this.maxDepth,
      minChildWeight: this.minChildWeight,
      l2: this.l2,
      nBins: this.nBins,
      featureSampleFrac: this.featureSampleFrac,
      featureMean: this.featureMean,
      featureStd: this.featureStd,
      binEdges: this.binEdges,
      trees: this.trees,
    };
  }

  static fromJSON(p: RandomForestParams): RandomForest {
    const m = new RandomForest({
      nTrees: p.nTrees,
      maxDepth: p.maxDepth,
      minChildWeight: p.minChildWeight,
      l2: p.l2,
      nBins: p.nBins,
      featureSampleFrac: p.featureSampleFrac,
    });
    m.featureMean = p.featureMean;
    m.featureStd = p.featureStd;
    m.binEdges = p.binEdges;
    m.trees = p.trees;
    return m;
  }
}
