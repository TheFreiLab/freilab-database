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

// `group` drives the <optgroup> the option appears under. Options with `libs` only
// apply to compounds from those libraries — everything else renders as a hollow
// "not applicable" ring rather than the filled "missing value" grey, since those
// compounds' library doesn't measure this property at all (see compute_embedding.py
// LIBRARY_SPECIFIC_PROPERTIES for why these can't be unified onto one shared scale).
const GROUP_COMPARABLE = 'Comparable across libraries'
const GROUP_SPECIFIC = 'Library-specific (not directly comparable)'

const COLOR_OPTIONS = [
  { key: 'lib',            label: 'Library', kind: 'categorical', palette: 'library', group: GROUP_COMPARABLE },
  { key: 'metal',           label: 'Metal',   kind: 'categorical', palette: 'metal', group: GROUP_COMPARABLE },
  { key: 'hek_viability',  label: 'HEK293T viability (%)', kind: 'continuous', scale: 'tox',  group: GROUP_COMPARABLE },
  { key: 'conversion_pct', label: 'Conversion (%)',        kind: 'continuous', scale: 'conv', group: GROUP_COMPARABLE },
  { key: 'rt_min',         label: 'Retention Time (min)',  kind: 'continuous', scale: 'default', group: GROUP_COMPARABLE },
  { key: 'lig_mw',         label: 'Σ Ligand MW (Da)',      kind: 'continuous', scale: 'default', group: GROUP_COMPARABLE },
  { key: 'lig_tpsa',       label: 'Σ Ligand TPSA (Å²)',    kind: 'continuous', scale: 'default', group: GROUP_COMPARABLE },
  { key: 'lig_logp',       label: 'Mean Ligand logP',      kind: 'continuous', scale: 'default', group: GROUP_COMPARABLE },
  { key: 'lig_hbd',        label: 'Σ Ligand HBD',          kind: 'continuous', scale: 'default', group: GROUP_COMPARABLE },
  { key: 'lig_hba',        label: 'Σ Ligand HBA',          kind: 'continuous', scale: 'default', group: GROUP_COMPARABLE },
  { key: 'lig_rotb',       label: 'Σ Ligand Rot. bonds',   kind: 'continuous', scale: 'default', group: GROUP_COMPARABLE },
  { key: 'lig_arring',     label: 'Σ Ligand Arom. rings',  kind: 'continuous', scale: 'default', group: GROUP_COMPARABLE },

  // Labels deliberately don't name libraries inline — labelWithLibs() appends
  // that from `libs` automatically, so adding a library to an existing entry
  // (or adding a new entry) never requires hand-editing label text.
  { key: 'sa_50_od',  label: 'S. aureus 50µM, OD',   kind: 'continuous', scale: 'activity', reverse: true, group: GROUP_SPECIFIC, libs: ['IrCpSB', 'NOSB'] },
  { key: 'sa_12_od',  label: 'S. aureus 12.5µM, OD', kind: 'continuous', scale: 'activity', reverse: true, group: GROUP_SPECIFIC, libs: ['IrCpSB', 'NOSB'] },
  { key: 'ec_50_od',  label: 'E. coli 50µM, OD',     kind: 'continuous', scale: 'activity', reverse: true, group: GROUP_SPECIFIC, libs: ['IrCpSB', 'NOSB'] },
  { key: 'ec_100_od', label: 'E. coli 100µM, OD',    kind: 'continuous', scale: 'activity', reverse: true, group: GROUP_SPECIFIC, libs: ['NOSB'] },
  // mic_um spans two different organisms/strains (TzLib: S. aureus, MnSB: MRSA) —
  // see the LIBRARY_SPECIFIC_PROPERTIES comment in compute_embedding.py.
  { key: 'mic_um',    label: 'MIC, µM',              kind: 'continuous', scale: 'activity', reverse: true, log: true, group: GROUP_SPECIFIC, libs: ['TzLib', 'MnSB'] },
  { key: 'sdr_um',    label: 'Selectivity SDR, µM',  kind: 'continuous', scale: 'selectivity',             group: GROUP_SPECIFIC, libs: ['TzLib'] },
]

// Appends "(Lib only)" or "(LibA/LibB)" from `opt.libs` rather than requiring
// it hand-typed into every label — the whole point being that adding a library
// to an option's `libs` array is enough, nothing else needs editing.
function labelWithLibs(opt) {
  if (!opt.libs) return opt.label
  return opt.libs.length === 1
    ? `${opt.label} (${opt.libs[0]} only)`
    : `${opt.label} (${opt.libs.join('/')})`
}

// Compare-tray cards deliberately show a curated subset, not every continuous
// COLOR_OPTION — showing all of them (incl. every ligand descriptor) made cards
// too busy to compare at a glance. Bioactivity/toxicity/selectivity assays, plus
// logP, RT and conversion (the two QC metrics worth keeping) — not MW/TPSA/HBD/
// HBA/rotatable bonds/aromatic rings.
const COMPARE_TRAY_KEYS = [
  'hek_viability', 'conversion_pct', 'rt_min', 'lig_logp',
  'sa_50_od', 'sa_12_od', 'ec_50_od', 'ec_100_od', 'mic_um', 'sdr_um',
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
  const [compareSet, setCompareSet] = useState(() => new Map()) // recKey -> record, insertion-ordered
  const [pendingRepin, setPendingRepin] = useState(null)        // record awaiting repin confirmation
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

  // For library-specific options, compounds outside `libs` don't have this property
  // at all (not just an unmeasured value) — rendered as a hollow ring, not grey.
  function isApplicable(rec) {
    return !colorOpt.libs || colorOpt.libs.includes(rec.lib)
  }

  function colorOf(rec) {
    if (colorOpt.kind === 'categorical') {
      return PALETTE[colorOpt.palette]?.[rec[colorOpt.key]] ?? PALETTE.missing
    }
    const v = rec[colorOpt.key]
    if (v === null || v === undefined || !isFinite(v)) return PALETTE.missing
    return getMetricColor(v, range.min, range.max, colorOpt.scale, { reverse: colorOpt.reverse, log: colorOpt.log })
  }

  // Properties to show in each compare-tray card: the curated COMPARE_TRAY_KEYS
  // list, filtered to whichever have a value for at least one compound currently
  // in the tray. Independent of the main "Colour by" selection — so comparing a
  // different property within the selected panel never touches the main
  // scatter's colouring/zoom/domain.
  const compareCols = useMemo(() => {
    if (compareSet.size === 0) return []
    const recs = [...compareSet.values()]
    return COLOR_OPTIONS.filter(o => COMPARE_TRAY_KEYS.includes(o.key) && recs.some(r => r[o.key] != null))
  }, [compareSet])

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

  function toggleCompare(rec) {
    setCompareSet(prev => {
      const next = new Map(prev)
      const key = recKey(rec)
      if (next.has(key)) next.delete(key)
      else next.set(key, rec)
      return next
    })
  }

  function addAllNeighborsToCompare() {
    if (!neighbors) return
    setCompareSet(prev => {
      const next = new Map(prev)
      for (const n of neighbors) {
        const rec = records[n.index]
        next.set(recKey(rec), rec)
      }
      return next
    })
  }

  // Clicking a highlighted neighbor toggles it into/out of the compare tray (focal compound
  // unchanged). Clicking anything else re-pins — but if the tray has items, that's deferred
  // behind a confirmation so an ordinary click never silently mixes unrelated searches together.
  function handleDotClick(rec) {
    const isSamePinned = pinned && pinned.id === rec.id && pinned.lib === rec.lib
    if (isSamePinned) return

    if (similarityMode && neighborSimilarity?.has(recKey(rec))) {
      toggleCompare(rec)
      return
    }
    if (compareSet.size > 0) {
      setPendingRepin(rec)
    } else {
      setPinned(rec)
      setTooltip(null)
    }
  }

  function confirmRepin(keepCompare) {
    if (!keepCompare) setCompareSet(new Map())
    setPinned(pendingRepin)
    setTooltip(null)
    setPendingRepin(null)
  }

  function renderInfoRows(rec) {
    return (
      <>
        <div className="explore-tooltip-row"><span>Library</span>{rec.lib}</div>
        <div className="explore-tooltip-row"><span>Metal</span>{rec.metal ?? '—'}</div>
        {colorOpt.kind === 'continuous' && (
          <div className="explore-tooltip-row">
            <span>{colorOpt.label}</span>
            {rec[colorOpt.key] !== null && rec[colorOpt.key] !== undefined ? rec[colorOpt.key].toFixed(2) : '—'}
          </div>
        )}
        {neighborSimilarity?.has(recKey(rec)) && (
          <div className="explore-tooltip-row">
            <span>Similarity</span>
            {(neighborSimilarity.get(recKey(rec)) * 100).toFixed(0)}%
          </div>
        )}
      </>
    )
  }

  // Like renderInfoRows, but for compare-tray cards: shows every property in
  // compareCols instead of just the currently-selected colour-by one.
  function renderCompareRows(rec) {
    return (
      <>
        <div className="explore-tooltip-row"><span>Library</span>{rec.lib}</div>
        <div className="explore-tooltip-row"><span>Metal</span>{rec.metal ?? '—'}</div>
        {compareCols.map(o => (
          <div key={o.key} className="explore-tooltip-row">
            <span>{o.label}</span>
            {rec[o.key] !== null && rec[o.key] !== undefined ? rec[o.key].toFixed(2) : '—'}
          </div>
        ))}
        {neighborSimilarity?.has(recKey(rec)) && (
          <div className="explore-tooltip-row">
            <span>Similarity</span>
            {(neighborSimilarity.get(recKey(rec)) * 100).toFixed(0)}%
          </div>
        )}
      </>
    )
  }

  function renderStructures(rec) {
    const svgs = getTooltipSvgs(rec, data.buildingBlocks)
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
  }

  return (
    <main className="explore-page">
      <div className="page-container">
        <div className="page-header">
          <h1>Chemical Space — All Libraries</h1>
          <p className="lead">
            One UMAP embedding fit across every compound in every library, from each
            compound's ELECTRUM fingerprint, so distances are comparable across
            library boundaries. "Colour by" is split into properties comparable across
            every library and ones specific to a subset (different assay, different
            units) — for those, compounds from a library that doesn't measure it show
            as a hollow ring rather than grey, not a missing value. A few entries (e.g.
            MIC) combine the same kind of measurement from more than one library even
            though the exact bacterial strain or protocol can differ between them —
            check a compound's own library page if you need the precise assay it was
            measured with.
          </p>
        </div>

        {error && <p className="error-msg">Failed to load combined embedding: {error}</p>}
        {!records && !error && <p className="loading-msg">Loading…</p>}

        {records && (
          <div className="explore-scatter-root">
            <label className="explore-color-select">
              <span>Colour by</span>
              <select value={colorKey} onChange={e => { setColorKey(e.target.value); closePinned() }}>
                {[GROUP_COMPARABLE, GROUP_SPECIFIC].map(group => (
                  <optgroup key={group} label={group}>
                    {COLOR_OPTIONS.filter(o => o.group === group).map(o => (
                      <option key={o.key} value={o.key}>{labelWithLibs(o)}</option>
                    ))}
                  </optgroup>
                ))}
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
                <span className="legend-label">
                  {labelWithLibs(colorOpt)} (grey = no value for this compound{colorOpt.libs ? '; hollow ring = not measured for this library' : ''})
                </span>
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
                  const isComparing = compareSet.has(recKey(rec))
                  // Library-specific colour-by: compounds from a library that doesn't
                  // measure this property render hollow, distinct from "measured but
                  // this compound's value is missing" (filled grey, via colorOf).
                  const isNotApplicable = colorOpt.kind === 'continuous' && !isApplicable(rec)
                  return (
                    <circle
                      key={`${rec.lib}-${rec.id}`}
                      cx={cx}
                      cy={cy}
                      r={isPinned ? 5 : 3}
                      fill={isNotApplicable ? 'none' : (isDimmed ? '#D8DCDE' : colorOf(rec))}
                      fillOpacity={isNotApplicable ? 1 : (isDimmed ? 0.35 : (isPinned ? 1 : 0.75))}
                      stroke={isPinned ? '#0C4E60' : (isComparing ? '#E69F00' : (isNotApplicable ? '#C8CDD0' : '#fff'))}
                      strokeWidth={isPinned ? 1.5 : (isComparing ? 2 : (isNotApplicable ? 1 : 0.5))}
                      className="explore-dot"
                      onMouseEnter={e => setTooltip({ rec, clientX: e.clientX, clientY: e.clientY })}
                      onMouseMove={e => setTooltip({ rec, clientX: e.clientX, clientY: e.clientY })}
                      onMouseLeave={() => setTooltip(null)}
                      onClick={() => handleDotClick(rec)}
                    />
                  )
                })}
              </g>
            </svg>

            {tooltip && (
              <div ref={tooltipRef} className="explore-tooltip">
                <div className="explore-tooltip-id">{tooltip.rec.id}</div>
                {renderInfoRows(tooltip.rec)}
                {renderStructures(tooltip.rec)}
              </div>
            )}

            {pendingRepin && (
              <div className="explore-repin-confirm">
                <p>
                  You have {compareSet.size} compound{compareSet.size > 1 ? 's' : ''} in your
                  comparison list.
                </p>
                <div className="explore-repin-confirm-actions">
                  <button onClick={() => confirmRepin(true)}>Keep comparing, switch focus</button>
                  <button onClick={() => confirmRepin(false)}>Clear comparison &amp; switch</button>
                  <button className="explore-repin-cancel" onClick={() => setPendingRepin(null)}>Cancel</button>
                </div>
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
                    <span className="explore-similarity-hint">Click a highlighted neighbor to compare it</span>
                    {neighbors && neighbors.length > 0 && (
                      <button className="explore-add-all-btn" onClick={addAllNeighborsToCompare}>
                        Add all {neighbors.length} neighbors to comparison
                      </button>
                    )}
                  </div>
                )}
                {renderStructures(pinned)}
                <Link to={`/compound/${pinned.lib}/${pinned.id}`} className="explore-pinned-link">
                  View compound details →
                </Link>
              </div>
            )}
          </div>
        )}

        {compareSet.size > 0 && (
          <div className="explore-compare-tray">
            <div className="explore-compare-header">
              <h2>Comparing {compareSet.size} compound{compareSet.size > 1 ? 's' : ''}</h2>
              <button onClick={() => setCompareSet(new Map())}>Clear all</button>
            </div>
            <div className="explore-compare-cards">
              {[...compareSet.values()].map(rec => (
                <div key={recKey(rec)} className="explore-compare-card">
                  <button className="explore-compare-card-remove" onClick={() => toggleCompare(rec)}>×</button>
                  <div className="explore-pinned-id">{rec.id}</div>
                  {renderCompareRows(rec)}
                  {renderStructures(rec)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
