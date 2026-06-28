import { useState, useEffect, useRef, useMemo } from 'react'
import LibraryGrid from './LibraryGrid'
import SelectivityScatter from './SelectivityScatter'
import './VizPanel.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getVal(compound, propKey) {
  const v = compound.props[propKey]
  if (v === null || v === undefined) return null
  return typeof v === 'object' ? v.avg : v
}

function loadPlotly() {
  return new Promise(resolve => {
    if (window.Plotly) { resolve(); return }
    const s = document.createElement('script')
    s.src = 'https://cdn.plot.ly/plotly-2.35.2.min.js'
    s.onload = resolve
    document.head.appendChild(s)
  })
}

// ── Histogram ─────────────────────────────────────────────────────────────────

function HistogramView({ library }) {
  const { positions, properties, building_blocks, compounds } = library
  const numericProps = properties.filter(p => p.role !== 'replicate')

  const [propKey,  setPropKey]  = useState(numericProps[0]?.key ?? '')
  const [groupBy,  setGroupBy]  = useState('')   // '' | posKey
  const [status,   setStatus]   = useState('idle')
  const plotRef = useRef(null)

  const prop = numericProps.find(p => p.key === propKey)

  const traces = useMemo(() => {
    if (!groupBy) {
      const vals = compounds.map(c => getVal(c, propKey)).filter(v => v !== null)
      return [{ x: vals, name: 'All', type: 'histogram', marker: { color: '#0d9488', opacity: 0.8 } }]
    }
    const bbs = building_blocks[groupBy] ?? []
    return bbs.map((bb, i) => {
      const vals = compounds
        .filter(c => c.blocks[groupBy] === bb.code)
        .map(c => getVal(c, propKey))
        .filter(v => v !== null)
      return { x: vals, name: bb.code, type: 'histogram', opacity: 0.6 }
    })
  }, [compounds, propKey, groupBy, building_blocks])

  useEffect(() => () => {
    if (window.Plotly && plotRef.current) window.Plotly.purge(plotRef.current)
  }, [])

  useEffect(() => {
    if (!plotRef.current) return
    let cancelled = false
    setStatus('loading')
    const propLabel = prop ? `${prop.label}${prop.unit ? ` (${prop.unit})` : ''}` : propKey

    loadPlotly().then(() => {
      if (cancelled || !plotRef.current) return
      window.Plotly.react(plotRef.current, traces, {
        margin: { t: 20, r: 20, b: 60, l: 60 },
        xaxis: { title: propLabel },
        yaxis: { title: 'Count' },
        bargap: 0.05,
        barmode: groupBy ? 'overlay' : 'relative',
        paper_bgcolor: 'white',
        plot_bgcolor: 'white',
        legend: groupBy ? { orientation: 'v' } : undefined,
        showlegend: !!groupBy,
      }, { responsive: true })
      setStatus('ready')
    })
    return () => { cancelled = true }
  }, [traces, prop, propKey, groupBy])

  const totalPoints = useMemo(() =>
    compounds.map(c => getVal(c, propKey)).filter(v => v !== null).length,
    [compounds, propKey])

  return (
    <div className="viz-view">
      <div className="viz-controls">
        <label className="viz-ctrl">
          <span>Property</span>
          <select value={propKey} onChange={e => setPropKey(e.target.value)}>
            {numericProps.map(p => (
              <option key={p.key} value={p.key}>{p.label}{p.unit ? ` (${p.unit})` : ''}</option>
            ))}
          </select>
        </label>
        <label className="viz-ctrl">
          <span>Colour by</span>
          <select value={groupBy} onChange={e => setGroupBy(e.target.value)}>
            <option value="">None</option>
            {positions.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </label>
        <span className="viz-stat">{totalPoints.toLocaleString()} data points</span>
      </div>
      {status === 'loading' && <p className="viz-loading">Loading chart…</p>}
      <div ref={plotRef} className="viz-plot" style={{ opacity: status === 'loading' ? 0 : 1 }} />
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function VizPanel({ library }) {
  const [tab, setTab] = useState('grid')

  return (
    <div className="viz-panel">
      <div className="viz-inner-tabs">
        <button className={tab === 'grid'      ? 'active' : ''} onClick={() => setTab('grid')}>Grid</button>
        <button className={tab === 'scatter'   ? 'active' : ''} onClick={() => setTab('scatter')}>Scatter</button>
        <button className={tab === 'chemspace' ? 'active' : ''} onClick={() => setTab('chemspace')}>Chemical space</button>
        <button className={tab === 'histogram' ? 'active' : ''} onClick={() => setTab('histogram')}>Histogram</button>
      </div>
      {tab === 'grid'      && <LibraryGrid       library={library} />}
      {tab === 'scatter'   && <SelectivityScatter library={library} />}
      {tab === 'chemspace' && <SelectivityScatter library={library} mode="umap" />}
      {tab === 'histogram' && <HistogramView      library={library} />}
    </div>
  )
}
