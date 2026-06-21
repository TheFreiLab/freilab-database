import { useState, useEffect, useRef, useMemo } from 'react'
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

// ── Heatmap ───────────────────────────────────────────────────────────────────

function HeatmapView({ library }) {
  const { positions, properties, building_blocks, compounds } = library
  const numericProps = properties.filter(p => p.role !== 'replicate')

  // Default: two largest positions as axes, smallest as third
  const sortedPos = useMemo(() =>
    [...positions].sort((a, b) =>
      (building_blocks[b.key]?.length ?? 0) - (building_blocks[a.key]?.length ?? 0)
    ), [positions, building_blocks])

  const [xPos,    setXPos]    = useState(sortedPos[1]?.key ?? positions[0].key)
  const [yPos,    setYPos]    = useState(sortedPos[0]?.key ?? positions[0].key)
  const [propKey, setPropKey] = useState(numericProps[0]?.key ?? '')
  const [thirdVal, setThirdVal] = useState('')
  const [reverse, setReverse] = useState(false)
  const [status,  setStatus]  = useState('idle')
  const plotRef = useRef(null)

  const thirdPos = positions.length >= 3
    ? positions.find(p => p.key !== xPos && p.key !== yPos) ?? null
    : null

  const xBBs = building_blocks[xPos] ?? []
  const yBBs = building_blocks[yPos] ?? []
  const prop  = numericProps.find(p => p.key === propKey)

  const matrix = useMemo(() =>
    yBBs.map(yBB =>
      xBBs.map(xBB => {
        const matches = compounds.filter(c =>
          c.blocks[xPos] === xBB.code &&
          c.blocks[yPos] === yBB.code &&
          (!thirdPos || !thirdVal || c.blocks[thirdPos.key] === thirdVal)
        )
        const vals = matches.map(c => getVal(c, propKey)).filter(v => v !== null)
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
      })
    ), [xBBs, yBBs, compounds, xPos, yPos, thirdPos, thirdVal, propKey])

  // Purge on unmount
  useEffect(() => () => {
    if (window.Plotly && plotRef.current) window.Plotly.purge(plotRef.current)
  }, [])

  // Render / update plot
  useEffect(() => {
    if (!plotRef.current) return
    let cancelled = false
    setStatus('loading')
    const xLabel = positions.find(p => p.key === xPos)?.label ?? xPos
    const yLabel = positions.find(p => p.key === yPos)?.label ?? yPos
    const propLabel = prop ? `${prop.label}${prop.unit ? ` (${prop.unit})` : ''}` : propKey

    loadPlotly().then(() => {
      if (cancelled || !plotRef.current) return
      window.Plotly.react(plotRef.current, [{
        type: 'heatmap',
        z: matrix,
        x: xBBs.map(b => b.code),
        y: yBBs.map(b => b.code),
        colorscale: 'Viridis',
        reversescale: reverse,
        hoverongaps: false,
        colorbar: { title: { text: propLabel, side: 'right' }, thickness: 16 },
        hovertemplate: `${xLabel}: %{x}<br>${yLabel}: %{y}<br>${propLabel}: %{z:.3f}<extra></extra>`,
      }], {
        margin: { t: 20, r: 110, b: 100, l: 70 },
        xaxis: { title: xLabel, tickangle: -45, automargin: true },
        yaxis: { title: yLabel, automargin: true },
        paper_bgcolor: 'white',
        plot_bgcolor: 'white',
      }, { responsive: true })
      setStatus('ready')
    })
    return () => { cancelled = true }
  }, [matrix, xBBs, yBBs, xPos, yPos, prop, propKey, positions, reverse])

  function handleXPos(v) {
    setXPos(v)
    if (v === yPos) setYPos(positions.find(p => p.key !== v)?.key ?? yPos)
  }
  function handleYPos(v) {
    setYPos(v)
    if (v === xPos) setXPos(positions.find(p => p.key !== v)?.key ?? xPos)
  }

  return (
    <div className="viz-view">
      <div className="viz-controls">
        <label className="viz-ctrl">
          <span>X axis</span>
          <select value={xPos} onChange={e => handleXPos(e.target.value)}>
            {positions.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </label>
        <label className="viz-ctrl">
          <span>Y axis</span>
          <select value={yPos} onChange={e => handleYPos(e.target.value)}>
            {positions.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </label>
        <label className="viz-ctrl">
          <span>Colour</span>
          <select value={propKey} onChange={e => setPropKey(e.target.value)}>
            {numericProps.map(p => (
              <option key={p.key} value={p.key}>{p.label}{p.unit ? ` (${p.unit})` : ''}</option>
            ))}
          </select>
        </label>
        {thirdPos && (
          <label className="viz-ctrl">
            <span>{thirdPos.label}</span>
            <select value={thirdVal} onChange={e => { setThirdVal(e.target.value) }}>
              <option value="">Average all</option>
              {(building_blocks[thirdPos.key] ?? []).map(bb => (
                <option key={bb.code} value={bb.code}>{bb.code}</option>
              ))}
            </select>
          </label>
        )}
        <label className="viz-ctrl viz-ctrl--inline">
          <input type="checkbox" checked={reverse} onChange={e => setReverse(e.target.checked)} />
          <span>Reverse scale</span>
        </label>
      </div>
      {status === 'loading' && <p className="viz-loading">Loading chart…</p>}
      <div ref={plotRef} className="viz-plot" style={{ opacity: status === 'loading' ? 0 : 1 }} />
    </div>
  )
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
  const [tab, setTab] = useState('heatmap')

  return (
    <div className="viz-panel">
      <div className="viz-inner-tabs">
        <button className={tab === 'heatmap'   ? 'active' : ''} onClick={() => setTab('heatmap')}>Heatmap</button>
        <button className={tab === 'histogram' ? 'active' : ''} onClick={() => setTab('histogram')}>Histogram</button>
      </div>
      {tab === 'heatmap'   && <HeatmapView   library={library} />}
      {tab === 'histogram' && <HistogramView  library={library} />}
    </div>
  )
}
