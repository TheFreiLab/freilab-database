import { useState, useMemo, useCallback } from 'react'
import { adaptLibrary, computeRange, computeAggregates } from '../../data/vizAdapter'
import { PALETTE, getFacetColor, interpolateColor } from '../../theme/palette'
import GridCanvas from './GridCanvas'
import GridTooltip from './GridTooltip'
import PinnedCard from './PinnedCard'
import MetricSwitcher from './MetricSwitcher'
import './LibraryGrid.css'

function buildColorBar(stops, reverse) {
  const s = reverse ? [...stops].reverse() : stops
  return `linear-gradient(to right, ${s.join(',')})`
}

export default function LibraryGrid({ library }) {
  const adapted = useMemo(() => adaptLibrary(library), [library])
  const [seriesIdx,   setSeriesIdx]   = useState(0)
  const [activeMetricKey, setActiveMetricKey] = useState(null)
  const [facetCode,   setFacetCode]   = useState(null)
  const [sortRows,    setSortRows]    = useState(false)
  const [sortCols,    setSortCols]    = useState(false)
  const [highlightRow, setHighlightRow] = useState(null)
  const [highlightCol, setHighlightCol] = useState(null)
  const [hovered,     setHovered]     = useState(null)
  const [pinned,      setPinned]      = useState(null)

  const grid           = adapted?.grids[seriesIdx] ?? null
  const metrics        = grid?.allMetrics ?? []
  const activeMetric   = metrics.find(m => m.key === activeMetricKey) ?? metrics[0] ?? null
  const effectiveFacet = facetCode ?? grid?.facetCodes[0] ?? null

  const facetCompounds = useMemo(() => {
    if (!grid) return []
    if (grid.facetDisplay !== 'selector') return grid.compounds
    return grid.compounds.filter(c => c._facet === effectiveFacet)
  }, [grid, effectiveFacet])

  const range = useMemo(() => {
    if (!grid || !activeMetric) return { min: 0, max: 1 }
    return computeRange(grid.compounds, activeMetric)
  }, [grid, activeMetric])

  const computeSortedCodes = useCallback((compounds, codes, dim, doSort, metric) => {
    if (!doSort) return codes
    const key = dim === 'row' ? '_row' : '_col'
    const means = {}
    for (const code of codes) {
      const vals = compounds.filter(c => c[key] === code).map(c => metric.getValue(c)).filter(v => v !== null && isFinite(v))
      means[code] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : -Infinity
    }
    return [...codes].sort((a, b) => means[b] - means[a])
  }, [])

  const rowCodes = useMemo(() => {
    if (!grid || !activeMetric) return []
    return computeSortedCodes(facetCompounds, grid.rowCodes, 'row', sortRows, activeMetric)
  }, [facetCompounds, grid, sortRows, activeMetric, computeSortedCodes])

  const colCodes = useMemo(() => {
    if (!grid || !activeMetric) return []
    return computeSortedCodes(facetCompounds, grid.colCodes, 'col', sortCols, activeMetric)
  }, [facetCompounds, grid, sortCols, activeMetric, computeSortedCodes])

  const rowAgg = useMemo(() => {
    if (!activeMetric) return {}
    return computeAggregates(facetCompounds, rowCodes, colCodes, activeMetric, 'row')
  }, [facetCompounds, rowCodes, colCodes, activeMetric])

  const colAgg = useMemo(() => {
    if (!activeMetric) return {}
    return computeAggregates(facetCompounds, rowCodes, colCodes, activeMetric, 'col')
  }, [facetCompounds, rowCodes, colCodes, activeMetric])

  const handleHover = useCallback((compound, clientX, clientY) => {
    setHovered(compound ? { compound, clientX, clientY } : null)
  }, [])
  const handlePin = useCallback((compound) => {
    setPinned(p => (p?.id === compound?.id ? null : compound))
  }, [])
  const handleMarginal = useCallback((dim, code) => {
    if (dim === 'row') setHighlightRow(r => (r === code ? null : code))
    else               setHighlightCol(c => (c === code ? null : code))
  }, [])

  if (!adapted) {
    return <p style={{ color: '#9CA3AF', padding: '1rem' }}>No visualisation config for this library.</p>
  }

  // When series changes reset volatile state
  const handleSeriesChange = (idx) => {
    setSeriesIdx(idx)
    setFacetCode(null)
    setActiveMetricKey(null)
    setHighlightRow(null)
    setHighlightCol(null)
    setPinned(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const renderGrid = (compounds, rowC, colC, rowA, colA, isSmall = false) => (
    <GridCanvas
      compounds={compounds}
      rowCodes={rowC}
      colCodes={colC}
      metric={activeMetric}
      range={range}
      rowAgg={rowA}
      colAgg={colA}
      highlightRow={highlightRow}
      highlightCol={highlightCol}
      hoveredCell={hovered?.compound ?? null}
      pinnedCell={pinned}
      onHover={handleHover}
      onPin={handlePin}
      onMarginalClick={handleMarginal}
      isSmall={isSmall}
    />
  )

  const legendGrad = buildColorBar(
    PALETTE.scales[activeMetric.scale] ?? PALETTE.scales.conv,
    activeMetric.reverse
  )
  const legendLo  = activeMetric.reverse ? range.max.toFixed(1) : range.min.toFixed(1)
  const legendHi  = activeMetric.reverse ? range.min.toFixed(1) : range.max.toFixed(1)

  return (
    <div className="library-grid-root">
      {/* Series selector (TzLib has 2 grids) */}
      {adapted.grids.length > 1 && (
        <div className="series-tabs">
          {adapted.grids.map((g, i) => (
            <button
              key={g.id}
              className={`series-tab${i === seriesIdx ? ' active' : ''}`}
              onClick={() => handleSeriesChange(i)}
            >
              {g.seriesLabel ?? g.id}
            </button>
          ))}
        </div>
      )}

      {/* Metric switcher */}
      <MetricSwitcher
        metrics={metrics}
        activeKey={activeMetric.key}
        onChange={k => setActiveMetricKey(k)}
      />

      {/* Controls row */}
      <div className="grid-controls">
        <button className={`sort-btn${sortRows ? ' active' : ''}`} onClick={() => setSortRows(r => !r)}>
          {sortRows ? 'Unsort rows' : 'Sort rows ↓'}
        </button>
        <button className={`sort-btn${sortCols ? ' active' : ''}`} onClick={() => setSortCols(c => !c)}>
          {sortCols ? 'Unsort cols' : 'Sort cols ↓'}
        </button>
        {(highlightRow || highlightCol) && (
          <button className="sort-btn" onClick={() => { setHighlightRow(null); setHighlightCol(null) }}>
            Clear highlight
          </button>
        )}
      </div>

      {/* ── Selector mode (IrCpSB): single grid + facet tabs ── */}
      {grid.facetDisplay === 'selector' && (
        <>
          <div className="facet-tabs">
            {grid.facetCodes.map(code => (
              <button
                key={code}
                className={`facet-tab${code === effectiveFacet ? ' active' : ''}`}
                onClick={() => setFacetCode(code)}
              >
                <span className="facet-dot" style={{ background: getFacetColor(code, adapted.facetType) }} />
                {code}
              </button>
            ))}
          </div>
          {renderGrid(facetCompounds, rowCodes, colCodes, rowAgg, colAgg)}
        </>
      )}

      {/* ── Small multiples (TzLib): one mini grid per facet ── */}
      {grid.facetDisplay === 'small-multiples' && (
        <div className="small-multiples">
          {grid.facetCodes.map(code => {
            const fc = grid.compounds.filter(c => c._facet === code)
            const fRowAgg = computeAggregates(fc, rowCodes, colCodes, activeMetric, 'row')
            const fColAgg = computeAggregates(fc, rowCodes, colCodes, activeMetric, 'col')
            return (
              <div key={code} className="small-multiple">
                <div className="facet-label">
                  <span className="facet-dot" style={{ background: getFacetColor(code, adapted.facetType) }} />
                  {code}
                </div>
                {renderGrid(fc, rowCodes, colCodes, fRowAgg, fColAgg, true)}
              </div>
            )
          })}
        </div>
      )}

      {/* Colour legend */}
      <div className="colour-legend">
        <span>{legendLo}{activeMetric.unit ? ' ' + activeMetric.unit : ''}</span>
        <div className="colour-legend-bar" style={{ background: legendGrad }} />
        <span>{legendHi}{activeMetric.unit ? ' ' + activeMetric.unit : ''}</span>
        {activeMetric.log && <span style={{ fontStyle: 'italic' }}>(log)</span>}
      </div>

      {/* Tooltip */}
      {hovered && (
        <GridTooltip
          compound={hovered.compound}
          metric={activeMetric}
          clientX={hovered.clientX}
          clientY={hovered.clientY}
          bbByPosition={grid.bbByPosition}
        />
      )}

      {/* Pinned card */}
      <PinnedCard
        compound={pinned}
        allMetrics={metrics}
        libId={library.id}
        bbByPosition={grid.bbByPosition}
        onClose={() => setPinned(null)}
      />
    </div>
  )
}
