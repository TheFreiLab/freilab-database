import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { getMetricColor, PALETTE } from '../theme/palette'
import { decodeFingerprint, topKNeighbors } from '../data/similarity'
import '../components/LibraryGrid/LibraryGrid.css'
import './ExploreAllPage.css'

const MARGIN = { top: 20, right: 20, bottom: 54, left: 58 }
const W = 760
const H = 560
const INNER_W = W - MARGIN.left - MARGIN.right
const INNER_H = H - MARGIN.top - MARGIN.bottom
const TICKS = 5
const PAD = 0.06 // UMAP coords are pre-normalised to [0,1]; just pad a little
const DEFAULT_DOMAIN = { x: [-PAD, 1 + PAD], y: [-PAD, 1 + PAD] }
const MIN_TOPK = 5
const MAX_TOPK = 50

function scaleLinear(domain, range) {
  const [d0, d1] = domain
  const [r0, r1] = range
  return v => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)
}
function niceTicks(min, max, n) {
  const step = (max - min) / n
  return Array.from({ length: n + 1 }, (_, i) => +(min + i * step).toPrecision(3))
}

function recKey(rec) {
  return `${rec.lib}::${rec.id}`
}

const COLOR_OPTIONS = [
  { key: 'lib',            label: 'Library', kind: 'categorical', palette: 'library' },
  { key: 'metal',           label: 'Metal',   kind: 'categorical', palette: 'metal' },
  { key: 'hek_viability',  label: 'HEK293T viability (%)', kind: 'continuous', scale: 'tox' },
  { key: 'conversion_pct', label: 'Conversion (%)',        kind: 'continuous', scale: 'conv' },
  { key: 'lig_mw',         label: 'Σ Ligand MW (Da)',      kind: 'continuous', scale: 'default' },
  { key: 'lig_tpsa',       label: 'Σ Ligand TPSA (Å²)',    kind: 'continuous', scale: 'default' },
  { key: 'lig_logp',       label: 'Mean Ligand logP',      kind: 'continuous', scale: 'default' },
  { key: 'lig_hbd',        label: 'Σ Ligand HBD',          kind: 'continuous', scale: 'default' },
  { key: 'lig_hba',        label: 'Σ Ligand HBA',          kind: 'continuous', scale: 'default' },
  { key: 'lig_rotb',       label: 'Σ Ligand Rot. bonds',   kind: 'continuous', scale: 'default' },
  { key: 'lig_arring',     label: 'Σ Ligand Arom. rings',  kind: 'continuous', scale: 'default' },
]

function computeRange(records, key) {
  let min = Infinity, max = -Infinity
  for (const r of records) {
    const v = r[key]
    if (v !== null && v !== undefined && isFinite(v)) {
      if (v < min) min = v
      if (v > max) max = v
    }
  }
  return min === Infinity ? { min: 0, max: 1 } : { min, max }
}

function getTooltipSvgs(rec, buildingBlocks) {
  const bbByPosition = buildingBlocks[rec.lib]
  return Object.entries(rec.blocks ?? {})
    .filter(([, code]) => code)
    .flatMap(([pos, code]) => {
      const bb = bbByPosition?.[pos]?.[code]
      return bb?.svg ? [{ pos, code, svg: bb.svg, name: bb.name ?? code }] : []
    })
}

export default function ExploreAllPage() {
  const [data, setData]       = useState(null)
  const [error, setError]     = useState(null)
  const [colorKey, setColorKey] = useState('lib')
  const [pinned, setPinned]   = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const [similarityMode, setSimilarityMode] = useState(false)
  const [topK, setTopK]       = useState(15)
  const tooltipRef = useRef(null)

  useEffect(() => {
    fetch('/data/combined_umap.json')
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })
      .then(setData)
      .catch(e => setError(e.message))
  }, [])

  const records = data?.compounds

  useEffect(() => {
    if (!tooltipRef.current || !tooltip) return
    const el = tooltipRef.current
    const { width: w, height: h } = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let left = tooltip.clientX + 14
    let top  = tooltip.clientY + 14
    if (left + w > vw - 8) left = tooltip.clientX - w - 14
    if (top  + h > vh - 8) top  = tooltip.clientY - h - 14
    el.style.left = left + 'px'
    el.style.top  = top  + 'px'
  })

  const colorOpt = COLOR_OPTIONS.find(o => o.key === colorKey)
  const range = useMemo(
    () => (colorOpt.kind === 'continuous' && records ? computeRange(records, colorKey) : null),
    [records, colorKey, colorOpt.kind]
  )

  function colorOf(rec) {
    if (colorOpt.kind === 'categorical') {
      return PALETTE[colorOpt.palette]?.[rec[colorOpt.key]] ?? PALETTE.missing
    }
    const v = rec[colorOpt.key]
    if (v === null || v === undefined || !isFinite(v)) return PALETTE.missing
    return getMetricColor(v, range.min, range.max, colorOpt.scale)
  }

  // "Find similar compounds" — Jaccard nearest-neighbor search over the precomputed
  // binarized ELECTRUM fingerprints (see converter/compute_embedding.py --combined).
  const fingerprints = useMemo(
    () => records ? records.map(r => decodeFingerprint(r.fp)) : null,
    [records]
  )
  const indexByKey = useMemo(() => {
    if (!records) return null
    const m = new Map()
    records.forEach((r, i) => m.set(recKey(r), i))
    return m
  }, [records])
  const pinnedIndex = pinned && indexByKey ? indexByKey.get(recKey(pinned)) : null

  const neighbors = useMemo(() => {
    if (!similarityMode || pinnedIndex == null || !fingerprints) return null
    return topKNeighbors(pinnedIndex, fingerprints, topK)
  }, [similarityMode, pinnedIndex, fingerprints, topK])

  // key -> similarity (0-1), only populated while similarity mode is active
  const neighborSimilarity = useMemo(() => {
    if (!neighbors) return null
    const m = new Map()
    for (const n of neighbors) m.set(recKey(records[n.index]), n.similarity)
    return m
  }, [neighbors, records])

  // Zoom/pan the plot to fit the pinned compound + its neighbors while similarity mode
  // is showing something; otherwise the full [0,1] UMAP extent.
  const domain = useMemo(() => {
    if (!similarityMode || !pinned || !neighbors || neighbors.length === 0) return DEFAULT_DOMAIN
    const pts = [pinned, ...neighbors.map(n => records[n.index])]
    const padAxis = (min, max) => {
      const span = Math.max(max - min, 0.04) // floor avoids divide-by-zero on tight clusters
      return [min - span * 0.25, max + span * 0.25]
    }
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
    return {
      x: padAxis(Math.min(...xs), Math.max(...xs)),
      y: padAxis(Math.min(...ys), Math.max(...ys)),
    }
  }, [similarityMode, pinned, neighbors, records])

  const scX = useMemo(() => scaleLinear(domain.x, [0, INNER_W]), [domain])
  const scY = useMemo(() => scaleLinear(domain.y, [INNER_H, 0]), [domain])
  const xTicks = useMemo(() => niceTicks(domain.x[0], domain.x[1], TICKS), [domain])
  const yTicks = useMemo(() => niceTicks(domain.y[0], domain.y[1], TICKS), [domain])

  function closePinned() {
    setPinned(null)
    setSimilarityMode(false)
  }

  return (
    <main className="explore-page">
      <div className="page-container">
        <div className="page-header">
          <h1>Chemical Space — All Libraries</h1>
          <p className="lead">
            One UMAP embedding fit across every compound in every library, from each
            compound's ELECTRUM fingerprint, so distances are comparable across
            library boundaries. Coloured properties are only shown where the
            underlying assay/metric is comparable across libraries; dots without
            that data are left grey.
          </p>
        </div>

        {error && <p className="error-msg">Failed to load combined embedding: {error}</p>}
        {!records && !error && <p className="loading-msg">Loading…</p>}

        {records && (
          <div className="explore-scatter-root">
            <label className="explore-color-select">
              <span>Colour by</span>
              <select value={colorKey} onChange={e => { setColorKey(e.target.value); closePinned() }}>
                {COLOR_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </label>

            {colorOpt.kind === 'categorical' ? (
              <div className="explore-legend-categorical">
                {Object.entries(PALETTE[colorOpt.palette]).map(([code, color]) => (
                  <span key={code} className="legend-chip">
                    <span className="legend-dot" style={{ background: color }} />
                    {code === 'null' ? 'none' : code}
                  </span>
                ))}
              </div>
            ) : (
              <div className="explore-legend-continuous">
                <span className="legend-val">{range.min.toFixed(2)}</span>
                <div
                  className="legend-gradient"
                  style={{ background: `linear-gradient(to right, ${PALETTE.scales[colorOpt.scale].join(',')})` }}
                />
                <span className="legend-val">{range.max.toFixed(2)}</span>
                <span className="legend-label">{colorOpt.label} (grey = not available for this compound)</span>
              </div>
            )}

            <svg className="explore-svg-wrap" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
              <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
                {yTicks.map(t => (
                  <line key={t} x1={0} x2={INNER_W} y1={scY(t)} y2={scY(t)} stroke="#E3E8EA" strokeWidth={0.8} />
                ))}
                {xTicks.map(t => (
                  <line key={t} x1={scX(t)} x2={scX(t)} y1={0} y2={INNER_H} stroke="#E3E8EA" strokeWidth={0.8} />
                ))}
                <line x1={0} x2={INNER_W} y1={INNER_H} y2={INNER_H} stroke="#9EADB5" strokeWidth={1} />
                <line x1={0} x2={0} y1={0} y2={INNER_H} stroke="#9EADB5" strokeWidth={1} />

                {xTicks.map(t => (
                  <text key={t} className="explore-tick-label" x={scX(t)} y={INNER_H + 14} textAnchor="middle">{t}</text>
                ))}
                {yTicks.map(t => (
                  <text key={t} className="explore-tick-label" x={-7} y={scY(t)} textAnchor="end" dominantBaseline="middle">{t}</text>
                ))}

                <text className="explore-axis-label" x={INNER_W / 2} y={INNER_H + 44} textAnchor="middle">UMAP 1</text>
                <text className="explore-axis-label" transform={`translate(-46,${INNER_H / 2}) rotate(-90)`} textAnchor="middle">UMAP 2</text>

                {records.map(rec => {
                  const cx = scX(rec.x)
                  const cy = scY(rec.y)
                  // Zoomed domains (similarity mode) are a sub-region of the full plot;
                  // points outside it fall outside the inner plot rect but are still
                  // within the <svg>'s own canvas, so they must be skipped explicitly
                  // rather than relying on overflow clipping.
                  if (cx < -10 || cx > INNER_W + 10 || cy < -10 || cy > INNER_H + 10) return null
                  const isPinned = pinned && pinned.id === rec.id && pinned.lib === rec.lib
                  const isNeighbor = neighborSimilarity?.has(recKey(rec)) ?? false
                  const isDimmed = similarityMode && !!neighbors && !isPinned && !isNeighbor
                  return (
                    <circle
                      key={`${rec.lib}-${rec.id}`}
                      cx={cx}
                      cy={cy}
                      r={isPinned ? 5 : 3}
                      fill={isDimmed ? '#D8DCDE' : colorOf(rec)}
                      fillOpacity={isDimmed ? 0.35 : (isPinned ? 1 : 0.75)}
                      stroke={isPinned ? '#0C4E60' : '#fff'}
                      strokeWidth={isPinned ? 1.5 : 0.5}
                      className="explore-dot"
                      onMouseEnter={e => setTooltip({ rec, clientX: e.clientX, clientY: e.clientY })}
                      onMouseMove={e => setTooltip({ rec, clientX: e.clientX, clientY: e.clientY })}
                      onMouseLeave={() => setTooltip(null)}
                      onClick={() => { setPinned(rec); setTooltip(null) }}
                    />
                  )
                })}
              </g>
            </svg>

            {tooltip && (
              <div ref={tooltipRef} className="explore-tooltip">
                <div className="explore-tooltip-id">{tooltip.rec.id}</div>
                <div className="explore-tooltip-row"><span>Library</span>{tooltip.rec.lib}</div>
                <div className="explore-tooltip-row"><span>Metal</span>{tooltip.rec.metal ?? '—'}</div>
                {colorOpt.kind === 'continuous' && (
                  <div className="explore-tooltip-row">
                    <span>{colorOpt.label}</span>
                    {tooltip.rec[colorOpt.key] !== null && tooltip.rec[colorOpt.key] !== undefined
                      ? tooltip.rec[colorOpt.key].toFixed(2) : '—'}
                  </div>
                )}
                {neighborSimilarity?.has(recKey(tooltip.rec)) && (
                  <div className="explore-tooltip-row">
                    <span>Similarity</span>
                    {(neighborSimilarity.get(recKey(tooltip.rec)) * 100).toFixed(0)}%
                  </div>
                )}
                {(() => {
                  const svgs = getTooltipSvgs(tooltip.rec, data.buildingBlocks)
                  return svgs.length > 0 && (
                    <div className="grid-tooltip-bbs">
                      {svgs.map(({ pos, code, svg, name }) => (
                        <div key={pos} className="grid-tooltip-bb">
                          <div className="bb-label">{pos}: {code}</div>
                          <div className="bb-svg" dangerouslySetInnerHTML={{ __html: svg }} title={name} />
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}

            {pinned && (
              <div className="explore-pinned-card">
                <button className="explore-pinned-close" onClick={closePinned}>×</button>
                <div className="explore-pinned-id">{pinned.id}</div>
                <div className="explore-pinned-lib">{pinned.lib} · {pinned.metal ?? 'no metal'}</div>
                <label className="explore-similarity-toggle">
                  <input
                    type="checkbox"
                    checked={similarityMode}
                    onChange={e => setSimilarityMode(e.target.checked)}
                  />
                  Show similar compounds
                </label>
                {similarityMode && (
                  <div className="explore-similarity-controls">
                    <span>Top {topK} most similar</span>
                    <input
                      type="range"
                      min={MIN_TOPK}
                      max={MAX_TOPK}
                      value={topK}
                      onChange={e => setTopK(+e.target.value)}
                    />
                  </div>
                )}
                {(() => {
                  const svgs = getTooltipSvgs(pinned, data.buildingBlocks)
                  return svgs.length > 0 && (
                    <div className="grid-tooltip-bbs">
                      {svgs.map(({ pos, code, svg, name }) => (
                        <div key={pos} className="grid-tooltip-bb">
                          <div className="bb-label">{pos}: {code}</div>
                          <div className="bb-svg" dangerouslySetInnerHTML={{ __html: svg }} title={name} />
                        </div>
                      ))}
                    </div>
                  )
                })()}
                <Link to={`/compound/${pinned.lib}/${pinned.id}`} className="explore-pinned-link">
                  View compound details →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
