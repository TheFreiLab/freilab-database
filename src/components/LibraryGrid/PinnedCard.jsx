import ThreeDViewer from '../ThreeDViewer'

export default function PinnedCard({ compound, allMetrics, libId, bbByPosition, onClose }) {
  if (!compound) return null

  const bbEntries = Object.entries(compound.blocks ?? {}).filter(([, code]) => code)
  const svgs = []
  for (const [pos, code] of bbEntries) {
    const bb = bbByPosition?.[pos]?.[code]
    if (bb?.svg) svgs.push({ pos, code, svg: bb.svg, name: bb.name ?? code })
  }

  return (
    <div className="pinned-card">
      <div className="pinned-card-header">
        <span className="pinned-card-id">{compound.id}</span>
        <button className="pinned-card-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      {/* Metrics table */}
      <table className="pinned-card-metrics">
        <tbody>
          {allMetrics.map(m => {
            const v = m.getValue(compound)
            const raw = compound.props?.[m.key]
            const reps = typeof raw === 'object' && raw?.reps ? raw.reps : null
            return (
              <tr key={m.key}>
                <td className="pm-label">{m.label}</td>
                <td className="pm-val">
                  {v !== null && v !== undefined ? v.toFixed(2) : '—'}
                  {m.unit ? <span className="pm-unit"> {m.unit}</span> : null}
                </td>
                {reps && (
                  <td className="pm-reps">n={reps.length}</td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* BB structures */}
      {svgs.length > 0 && (
        <div className="pinned-card-bbs">
          {svgs.map(({ pos, code, svg, name }) => (
            <div key={pos} className="pinned-bb">
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

      {/* 3D viewer */}
      <div className="pinned-card-3d">
        <ThreeDViewer libId={libId} compoundId={compound.id} height={220} />
      </div>
    </div>
  )
}
