// ============================================================================
//  Logistic regression baseline (binary classification) with L2 regularization.
//  Trained by full-batch gradient descent on the cross-entropy loss. Standardizes
//  features using training mean/std. Also exposes a per-feature contribution
//  (weight * standardized value) for SHAP-style local explanations.
// ============================================================================

import { mean, std } from "./stats";

export interface LogRegParams {
  weights: number[];
  bias: number;
  featureMean: number[];
  featureStd: number[];
  learningRate: number;
  epochs: number;
  l2: number;
}

export class LogisticRegression {
  weights: number[] = [];
  bias = 0;
  featureMean: number[] = [];
  featureStd: number[] = [];
  learningRate = 0.1;
  epochs = 400;
  l2 = 1e-3;

  fit(X: number[][], y: number[], opts?: Partial<LogRegParams>) {
    this.learningRate = opts?.learningRate ?? this.learningRate;
    this.epochs = opts?.epochs ?? this.epochs;
    this.l2 = opts?.l2 ?? this.l2;

    const n = X.length;
    const d = X[0].length;
    // standardization stats
    this.featureMean = [];
    this.featureStd = [];
    for (let j = 0; j < d; j++) {
      const col = X.map((r) => r[j]);
      this.featureMean.push(mean(col));
      this.featureStd.push(std(col));
    }
    // standardize
    const Xs = X.map((r) => r.map((v, j) => (this.featureStd[j] > 1e-9 ? (v - this.featureMean[j]) / this.featureStd[j] : 0)));

    this.weights = new Array(d).fill(0);
    this.bias = 0;

    for (let epoch = 0; epoch < this.epochs; epoch++) {
      const gradW = new Array(d).fill(0);
      let gradB = 0;
      for (let i = 0; i < n; i++) {
        const p = this.predictRawStd(Xs[i]);
        const err = p - y[i];
        for (let j = 0; j < d; j++) gradW[j] += err * Xs[i][j];
        gradB += err;
      }
      for (let j = 0; j < d; j++) {
        gradW[j] = gradW[j] / n + this.l2 * this.weights[j];
        this.weights[j] -= this.learningRate * gradW[j];
      }
      this.bias -= this.learningRate * (gradB / n);
    }
  }

  private sigmoid(z: number): number {
    if (z >= 0) return 1 / (1 + Math.exp(-z));
    const e = Math.exp(z);
    return e / (1 + e);
  }
  private predictRawStd(xs: number[]): number {
    let z = this.bias;
    for (let j = 0; j < xs.length; j++) z += this.weights[j] * xs[j];
    return z;
  }
  /** Predict probability on a raw (un-standardized) feature vector. */
  predictProba(x: number[]): number {
    const xs = x.map((v, j) => (this.featureStd[j] > 1e-9 ? (v - this.featureMean[j]) / this.featureStd[j] : 0));
    return this.sigmoid(this.predictRawStd(xs));
  }
  /** Per-feature contribution to the log-odds for a single sample (SHAP-style). */
  contributions(x: number[]): { feature: number; value: number; contribution: number }[] {
    const xs = x.map((v, j) => (this.featureStd[j] > 1e-9 ? (v - this.featureMean[j]) / this.featureStd[j] : 0));
    const out: { feature: number; value: number; contribution: number }[] = [];
    for (let j = 0; j < xs.length; j++) {
      out.push({ feature: j, value: x[j], contribution: this.weights[j] * xs[j] });
    }
    return out;
  }
  toJSON(): LogRegParams {
    return {
      weights: this.weights,
      bias: this.bias,
      featureMean: this.featureMean,
      featureStd: this.featureStd,
      learningRate: this.learningRate,
      epochs: this.epochs,
      l2: this.l2,
    };
  }
  static fromJSON(p: LogRegParams): LogisticRegression {
    const m = new LogisticRegression();
    m.weights = p.weights;
    m.bias = p.bias;
    m.featureMean = p.featureMean;
    m.featureStd = p.featureStd;
    m.learningRate = p.learningRate;
    m.epochs = p.epochs;
    m.l2 = p.l2;
    return m;
  }
}
