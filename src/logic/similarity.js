export function cosineSimilarityMissing(a, b, keys, minCommonDims = 2) {
  let dot = 0, normA = 0, normB = 0, common = 0;

  for (const k of keys) {
    const va = a[k];
    const vb = b[k];
    if (va == null || vb == null) continue;

    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
    common++;
  }
  if (common < minCommonDims) return null;

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return null;

  return dot / denom;
}

export function peakIndexRow(row, keys) {
  let best = -Infinity, idx = -1;
  for (let i = 0; i < keys.length; i++) {
    const v = row[keys[i]];
    if (v == null) continue;
    if (v > best) { best = v; idx = i; }
  }
  return idx;
}