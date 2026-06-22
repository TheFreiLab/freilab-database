import { useState, useMemo, useRef, useEffect } from 'react'
import { adaptLibrary } from '../../data/vizAdapter'
import { getFacetColor } from '../../theme/palette'
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

export default function SelectivityScatter({ library }) {
  const adapted = useMemo(() => adaptLibrary(library), [library])
  const [seriesIdx, setSeriesIdx] = useState(0)
  const [modeIdx, setModeIdx] = useState(0)
  const [tooltip, setTooltip] = useState(null) // { compound, clientX, clientY }
  const tooltipRef = useRef(null)

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

  if (!adapted) return null
  const grid = adapted.grids[seriesIdx]
  const compounds = grid.compounds
  const modes = grid.scatterModes
  const safeIdx = Math.min(modeIdx, modes.length - 1)
  const { xAxis, yAxis } = modes[safeIdx]

  const points = useMemo(() => {
    return compounds.map(c => {
      const x = xAxis.getValue(c)
      const y = yAxis.getValue(c)
      return { compound: c, x, y }
    }).filter(p => p.x !== null && p.y !== null && isFinite(p.x) && isFinite(p.y))
  }, [compounds, xAxis, yAxis])

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

  const facetType = adapted.facetType

  return (
    <div className="scatter-root">
      {/* Series selector */}
      {adapted.grids.length > 1 && (
        <div className="series-tabs" style={{ marginBottom: 8 }}>
          {adapted.grids.map((g, i) => (
            <button key={g.id} className={`series-tab${i === seriesIdx ? ' active' : ''}`}
              onClick={() => { setSeriesIdx(i); setModeIdx(0) }}>
              {g.seriesLabel ?? g.id}
            </button>
          ))}
        </div>
      )}

      {/* Mode tabs */}
      <div className="scatter-mode-tabs">
        {modes.map((m, i) => (
          <button
            key={i}
            className={`scatter-mode-tab${i === safeIdx ? ' active' : ''}`}
            onClick={() => setModeIdx(i)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* SVG scatter */}
      <svg
        className="scatter-svg-wrap"
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* Grid lines */}
          {yTicks.map(t => (
            <line key={t} x1={0} x2={INNER_W} y1={scY(t)} y2={scY(t)} stroke="#E3E8EA" strokeWidth={0.8} />
          ))}
          {xTicks.map(t => (
            <line key={t} x1={scX(t)} x2={scX(t)} y1={0} y2={INNER_H} stroke="#E3E8EA" strokeWidth={0.8} />
          ))}

          {/* Axes */}
          <line x1={0} x2={INNER_W} y1={INNER_H} y2={INNER_H} stroke="#9EADB5" strokeWidth={1} />
          <line x1={0} x2={0} y1={0} y2={INNER_H} stroke="#9EADB5" strokeWidth={1} />

          {/* X ticks */}
          {xTicks.map(t => (
            <g key={t} transform={`translate(${scX(t)},${INNER_H})`}>
              <line y2={4} stroke="#9EADB5" />
              <text className="scatter-tick-label" y={14} textAnchor="middle">
                {xAxis.log ? `10^${Math.round(Math.log10(t))}` : t}
              </text>
            </g>
          ))}

          {/* Y ticks */}
          {yTicks.map(t => (
            <g key={t} transform={`translate(0,${scY(t)})`}>
              <line x2={-4} stroke="#9EADB5" />
              <text className="scatter-tick-label" x={-7} textAnchor="end" dominantBaseline="middle">
                {yAxis.log ? `10^${Math.round(Math.log10(t))}` : t}
              </text>
            </g>
          ))}

          {/* Axis labels */}
          <text
            className="scatter-axis-label"
            x={INNER_W / 2} y={INNER_H + 44}
            textAnchor="middle"
          >
            {xAxis.label}
          </text>
          <text
            className="scatter-axis-label"
            transform={`translate(-46,${INNER_H / 2}) rotate(-90)`}
            textAnchor="middle"
          >
            {yAxis.label}
          </text>

          {/* Points */}
          {points.map(({ compound, x, y }) => {
            const cx = scX(x)
            const cy = scY(y)
            if (!isFinite(cx) || !isFinite(cy)) return null
            return (
              <circle
                key={compound.id}
                className="scatter-dot"
                cx={cx}
                cy={cy}
                r={4}
                fill={getFacetColor(compound._facet, facetType)}
                fillOpacity={0.8}
                stroke="#fff"
                strokeWidth={0.8}
                onMouseEnter={e => setTooltip({ compound, clientX: e.clientX, clientY: e.clientY })}
                onMouseMove={e => setTooltip(t => ({ ...t, clientX: e.clientX, clientY: e.clientY }))}
                onMouseLeave={() => setTooltip(null)}
              />
            )
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div ref={tooltipRef} className="scatter-tooltip">
          <div className="scatter-tooltip-id">{tooltip.compound.id}</div>
          <div className="scatter-tooltip-row">
            {xAxis.label}: <span>{xAxis.getValue(tooltip.compound)?.toFixed(2) ?? '—'}</span>
          </div>
          <div className="scatter-tooltip-row">
            {yAxis.label}: <span>{yAxis.getValue(tooltip.compound)?.toFixed(2) ?? '—'}</span>
          </div>
          <div className="scatter-tooltip-row">
            {grid.facetPosition}: <span>{tooltip.compound._facet}</span>
          </div>
        </div>
      )}
    </div>
  )
}
