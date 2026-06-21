import { useEffect, useRef } from 'react'

export default function GridTooltip({ compound, metric, clientX, clientY, bbByPosition }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current || !compound) return
    const el = ref.current
    const vw = window.innerWidth
    const vh = window.innerHeight
    const { width: w, height: h } = el.getBoundingClientRect()
    let left = clientX + 14
    let top  = clientY + 14
    if (left + w > vw - 8) left = clientX - w - 14
    if (top  + h > vh - 8) top  = clientY - h - 14
    el.style.left = left + 'px'
    el.style.top  = top  + 'px'
  })

  if (!compound) return null

  const value = metric.getValue(compound)
  const fmtValue = value !== null && value !== undefined ? value.toFixed(2) : '—'

  const bbEntries = Object.entries(compound.blocks ?? {}).filter(([, code]) => code)
  const svgs = []
  for (const [pos, code] of bbEntries) {
    const bb = bbByPosition?.[pos]?.[code]
    if (bb?.svg) svgs.push({ pos, code, svg: bb.svg, name: bb.name ?? code })
  }

  return (
    <div ref={ref} className="grid-tooltip" role="tooltip">
      <div className="grid-tooltip-id">{compound.id}</div>
      <div className="grid-tooltip-metric">
        <span className="metric-label">{metric.label}</span>
        <span className="metric-val">{fmtValue}{metric.unit ? ` ${metric.unit}` : ''}</span>
      </div>
      {svgs.length > 0 && (
        <div className="grid-tooltip-bbs">
          {svgs.map(({ pos, code, svg, name }) => (
            <div key={pos} className="grid-tooltip-bb">
              <div className="bb-label">{pos}: {code}</div>
              <div
                className="bb-svg"
                dangerouslySetInnerHTML={{ __html: svg }}
                title={name}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
