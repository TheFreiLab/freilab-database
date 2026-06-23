import { useState, useMemo, useRef, useEffect } from 'react'
import { adaptLibrary, computeRange } from '../../data/vizAdapter'
import { getFacetColor, getMetricColor, PALETTE } from '../../theme/palette'
import PinnedCard from '../LibraryGrid/PinnedCard'
import '../LibraryGrid/LibraryGrid.css'
import './SelectivityScatter.css'

const MARGIN = { top: 20, right: 20, bottom: 54, left: 58 }
const W = 520
const H = 360
const INNER_W = W - MARGIN.left - MARGIN.right
const INNER_H = H - MARGIN.top - MARGIN.bottom
const TICKS = 5

function scaleLinear(domain, range) {
  const [d0, d1] = domain
  const [r0, r1] = range
  return v => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)
}
function scaleLog(domain, range) {
  const [d0, d1] = domain
  const [r0, r1] = range
  const l0 = Math.log10(Math.max(d0, 1e-9))
  const l1 = Math.log10(Math.max(d1, 1e-9))
  return v => r0 + ((Math.log10(Math.max(v, 1e-9)) - l0) / (l1 - l0)) * (r1 - r0)
}

function niceTicks(min, max, n) {
  const step = (max - min) / n
  return Array.from({ length: n + 1 }, (_, i) => +(min + i * step).toPrecision(3))
}
function niceLogTicks(min, max) {
  const lo = Math.floor(Math.log10(Math.max(min, 1e-9)))
  const hi = Math.ceil(Math.log10(Math.max(max, 1e-9)))
  const ticks = []
  for (let e = lo; e <= hi; e++) ticks.push(Math.pow(10, e))
  return ticks
}

function getTooltipSvgs(compound, bbByPosition) {
  return Object.entries(compound.blocks ?? {})
    .filter(([, code]) => code)
    .flatMap(([pos, code]) => {
      const bb = bbByPosition?.[pos]?.[code]
      return bb?.svg ? [{ pos, code, svg: bb.svg, name: bb.name ?? code }] : []
    })
}

// Build the "colour by" options for chemical-space mode: every scatter axis
// (properties + ligand descriptors), enriched with the colour scale already
// curated for that property in the grid metrics (role/reverse/log), falling
// back to a neutral sequential ramp for axes with no curated metric (e.g.
// ligand descriptors).
function buildColorableAxes(grid) {
  return grid.scatterAxes.map(axis => {
    const metric = grid.allMetrics.find(m => m.key === axis.key)
    return {
      key: axis.key,
      label: axis.label,
      getValue: axis.getValue,
      scale: metric?.scale ?? 'default',
      reverse: metric?.reverse ?? false,
      log: metric?.log ?? axis.log,
    }
  })
}

export default function SelectivityScatter({ library, mode = 'free' }) {
  const adapted = useMemo(() => adaptLibrary(library), [library])
  const [seriesIdx, setSeriesIdx] = useState(0)
  const [pinned, setPinned] = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const [colorKey, setColorKey] = useState('facet')
  const tooltipRef = useRef(null)

  const grid = adapted?.grids[seriesIdx]
  const [xKey, setXKey] = useState(() => mode === 'umap' ? 'umap_x' : grid?.scatterDefaultX)
  const [yKey, setYKey] = useState(() => mode === 'umap' ? 'umap_y' : grid?.scatterDefaultY)

  useEffect(() => {
    if (!grid) return
    if (mode === 'umap') {
      setXKey('umap_x')
      setYKey('umap_y')
    } else {
      setXKey(grid.scatterDefaultX)
      setYKey(grid.scatterDefaultY)
    }
    setPinned(null)
  }, [seriesIdx, mode, grid])

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

  if (!adapted || !grid) return null

  const axes = mode === 'umap' ? grid.umapAxes : grid.scatterAxes
  const xAxis = axes.find(a => a.key === xKey) ?? axes[0]
  const yAxis = axes.find(a => a.key === yKey) ?? axes[1]

  const colorableAxes = mode === 'umap' ? buildColorableAxes(grid) : null
  const colorAxis = colorableAxes?.find(a => a.key === colorKey) ?? null
  const colorRange = colorAxis ? computeRange(grid.compounds, colorAxis) : null

  function colorOf(compound) {
    if (!colorAxis) return getFacetColor(compound._facet, adapted.facetType)
    const v = colorAxis.getValue(compound)
    if (v === null || v === undefined || !isFinite(v)) return PALETTE.missing
    return getMetricColor(v, colorRange.min, colorRange.max, colorAxis.scale, {
      reverse: colorAxis.reverse, log: colorAxis.log,
    })
  }

  const points = useMemo(() => {
    return grid.compounds.map(c => {
      const x = xAxis.getValue(c)
      const y = yAxis.getValue(c)
      return { compound: c, x, y }
    }).filter(p => p.x !== null && p.y !== null && isFinite(p.x) && isFinite(p.y))
  }, [grid.compounds, xAxis, yAxis])

  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  const xMin = Math.min(...xs), xMax = Math.max(...xs)
  const yMin = Math.min(...ys), yMax = Math.max(...ys)

  const pad = (min, max, logScale) => {
    if (logScale) {
      return [Math.pow(10, Math.floor(Math.log10(Math.max(min, 1e-9)))),
              Math.pow(10, Math.ceil(Math.log10(Math.max(max, 1e-9))))]
    }
    const span = max - min || 1
    return [min - span * 0.05, max + span * 0.05]
  }

  const [xd0, xd1] = pad(xMin, xMax, xAxis.log)
  const [yd0, yd1] = pad(yMin, yMax, yAxis.log)

  const scX = xAxis.log ? scaleLog([xd0, xd1], [0, INNER_W]) : scaleLinear([xd0, xd1], [0, INNER_W])
  const scY = yAxis.log ? scaleLog([yd0, yd1], [INNER_H, 0]) : scaleLinear([yd0, yd1], [INNER_H, 0])

  const xTicks = xAxis.log ? niceLogTicks(xd0, xd1) : niceTicks(xd0, xd1, TICKS)
  const yTicks = yAxis.log ? niceLogTicks(yd0, yd1) : niceTicks(yd0, yd1, TICKS)

  const legendStops = colorAxis ? PALETTE.scales[colorAxis.scale] ?? PALETTE.scales.default : null
  const [legendLeftVal, legendRightVal] = colorAxis?.reverse
    ? [colorRange.max, colorRange.min]
    : [colorRange?.min, colorRange?.max]

  return (
    <div className="scatter-root">
      {/* Series selector */}
      {adapted.grids.length > 1 && (
        <div className="series-tabs">
          {adapted.grids.map((g, i) => (
            <button key={g.id} className={`series-tab${i === seriesIdx ? ' active' : ''}`}
              onClick={() => setSeriesIdx(i)}>
              {g.seriesLabel ?? g.id}
            </button>
          ))}
        </div>
      )}

      {/* Axis / colour selectors */}
      <div className="scatter-axis-selectors">
        {mode === 'umap' ? (
          <label className="scatter-axis-label-select">
            <span>Colour by</span>
            <select value={colorKey} onChange={e => setColorKey(e.target.value)}>
              <option value="facet">{grid.facetPosition}</option>
              {colorableAxes.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
          </label>
        ) : (
          <>
            <label className="scatter-axis-label-select">
              <span>X axis</span>
              <select value={xKey} onChange={e => setXKey(e.target.value)}>
                {axes.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
            </label>
            <label className="scatter-axis-label-select">
              <span>Y axis</span>
              <select value={yKey} onChange={e => setYKey(e.target.value)}>
                {axes.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
            </label>
          </>
        )}
      </div>

      {/* Colour legend (chemical-space mode, continuous properties only) */}
      {colorAxis && (
        <div className="scatter-color-legend">
          <span className="legend-val">{legendLeftVal?.toFixed(2)}</span>
          <div className="legend-gradient" style={{ background: `linear-gradient(to right, ${legendStops.join(',')})` }} />
          <span className="legend-val">{legendRightVal?.toFixed(2)}</span>
          <span className="legend-label">{colorAxis.label}</span>
        </div>
      )}

      {/* SVG scatter */}
      <svg
        className="scatter-svg-wrap"
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
      >
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
            <g key={t} transform={`translate(${scX(t)},${INNER_H})`}>
              <line y2={4} stroke="#9EADB5" />
              <text className="scatter-tick-label" y={14} textAnchor="middle">
                {xAxis.log ? `10^${Math.round(Math.log10(t))}` : t}
              </text>
            </g>
          ))}

          {yTicks.map(t => (
            <g key={t} transform={`translate(0,${scY(t)})`}>
              <line x2={-4} stroke="#9EADB5" />
              <text className="scatter-tick-label" x={-7} textAnchor="end" dominantBaseline="middle">
                {yAxis.log ? `10^${Math.round(Math.log10(t))}` : t}
              </text>
            </g>
          ))}

          <text className="scatter-axis-label-svg" x={INNER_W / 2} y={INNER_H + 44} textAnchor="middle">
            {xAxis.label}
          </text>
          <text
            className="scatter-axis-label-svg"
            transform={`translate(-46,${INNER_H / 2}) rotate(-90)`}
            textAnchor="middle"
          >
            {yAxis.label}
          </text>

          {points.map(({ compound, x, y }) => {
            const cx = scX(x)
            const cy = scY(y)
            if (!isFinite(cx) || !isFinite(cy)) return null
            const isPinned = pinned?.id === compound.id
            return (
              <circle
                key={compound.id}
                className="scatter-dot"
                cx={cx}
                cy={cy}
                r={isPinned ? 6 : 4}
                fill={colorOf(compound)}
                fillOpacity={isPinned ? 1 : 0.8}
                stroke={isPinned ? '#0C4E60' : '#fff'}
                strokeWidth={isPinned ? 1.5 : 0.8}
                onMouseEnter={e => setTooltip({ compound, clientX: e.clientX, clientY: e.clientY })}
                onMouseMove={e => setTooltip({ compound, clientX: e.clientX, clientY: e.clientY })}
                onMouseLeave={() => setTooltip(null)}
                onClick={() => { setPinned(compound); setTooltip(null) }}
              />
            )
          })}
        </g>
      </svg>

      {/* Hover tooltip */}
      {tooltip && (
        <div ref={tooltipRef} className="grid-tooltip">
          <div className="grid-tooltip-id">{tooltip.compound.id}</div>
          <div className="grid-tooltip-metric">
            <span className="metric-label">{xAxis.label}</span>
            <span className="metric-val">{xAxis.getValue(tooltip.compound)?.toFixed(2) ?? '—'}</span>
          </div>
          <div className="grid-tooltip-metric">
            <span className="metric-label">{yAxis.label}</span>
            <span className="metric-val">{yAxis.getValue(tooltip.compound)?.toFixed(2) ?? '—'}</span>
          </div>
          {colorAxis && (
            <div className="grid-tooltip-metric">
              <span className="metric-label">{colorAxis.label}</span>
              <span className="metric-val">{colorAxis.getValue(tooltip.compound)?.toFixed(2) ?? '—'}</span>
            </div>
          )}
          {(() => {
            const svgs = getTooltipSvgs(tooltip.compound, grid.bbByPosition)
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

      {/* Pinned card */}
      {pinned && (
        <PinnedCard
          compound={pinned}
          allMetrics={grid.allMetrics}
          libId={library.id}
          bbByPosition={grid.bbByPosition}
          onClose={() => setPinned(null)}
        />
      )}
    </div>
  )
}
