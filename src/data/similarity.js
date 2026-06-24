// Client-side Jaccard/Tanimoto nearest-neighbor search over the binarized, bit-packed
// ELECTRUM fingerprints written by converter/compute_embedding.py --combined ("fp" field,
// base64 of 75 bytes / 598 bits). Computed on demand, not precomputed: 2,480 compounds x 75
// bytes is trivial to scan in full on every click or slider move.

const POPCOUNT = new Uint8Array(256)
for (let i = 1; i < 256; i++) POPCOUNT[i] = POPCOUNT[i >> 1] + (i & 1)

export function decodeFingerprint(base64) {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

export function jaccardSimilarity(a, b) {
  let inter = 0, union = 0
  for (let i = 0; i < a.length; i++) {
    inter += POPCOUNT[a[i] & b[i]]
    union += POPCOUNT[a[i] | b[i]]
  }
  return union === 0 ? 0 : inter / union
}

// The k most similar fingerprints to fingerprints[targetIndex], excluding itself,
// sorted by descending similarity.
export function topKNeighbors(targetIndex, fingerprints, k) {
  const target = fingerprints[targetIndex]
  const scored = []
  for (let i = 0; i < fingerprints.length; i++) {
    if (i === targetIndex) continue
    scored.push({ index: i, similarity: jaccardSimilarity(target, fingerprints[i]) })
  }
  scored.sort((a, b) => b.similarity - a.similarity)
  return scored.slice(0, k)
}
