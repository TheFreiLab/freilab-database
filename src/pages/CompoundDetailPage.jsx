import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import BBCard from '../components/BBCard'
import ThreeDViewer from '../components/ThreeDViewer'
import LcmsViewer from '../components/LcmsViewer'
import './CompoundDetailPage.css'

// ── Property value formatting ────────────────────────────────────────────────

function fmtNum(n, unit) {
  if (n === null || n === undefined) return null
  if (unit === '%')   return `${n.toFixed(1)} %`
  if (unit === 'min') return `${n.toFixed(3)} min`
  if (unit === 'OD')  return n.toFixed(4)
  if (unit === 'µM')  return `${n.toFixed(2)} µM`
  if (unit === 'Da')  return `${n.toFixed(1)} Da`
  if (unit === 'Å²')  return `${n.toFixed(1)} Å²`
  // Integer-valued counts (HBD/HBA/rings/rot. bonds) render without decimals
  if (unit === null && Number.isInteger(n)) return String(n)
  return n.toFixed(2)
}

function PropRow({ prop, value, raw }) {
  const isObj = value !== null && typeof value === 'object'
  const avg   = isObj ? value.avg  : value
  const reps  = isObj ? value.reps : null
  const sd    = isObj ? value.sd   : null

  const displayAvg = fmtNum(avg, prop.unit)
  // MnSB's mic_um is the only property with a non-numeric source value (">100",
  // a dilution range like "50-25") — raw preserves that literal text outside
  // the numeric properties system. One-off, not a generic schema feature.
  const showRaw = prop.key === 'mic_um' && raw

  return (
    <tr className="prop-row">
      <td className="prop-label">{prop.label}</td>
      <td className="prop-value">
        {displayAvg !== null
          ? <span className="prop-avg">{displayAvg}</span>
          : <span className="missing">—</span>
        }
        {showRaw && <span className="prop-raw"> (reported as {raw})</span>}
        {reps && reps.some(r => r !== null) && (
          <span className="prop-reps">
            [{reps.map((r, i) => (
              <span key={i}>{r !== null ? fmtNum(r, prop.unit) : '—'}{i < reps.length - 1 ? ', ' : ''}</span>
            ))}]
          </span>
        )}
        {sd !== null && sd !== undefined && (
          <span className="prop-sd"> ± {fmtNum(sd, prop.unit)}</span>
        )}
      </td>
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CompoundDetailPage() {
  const { libId, compoundId } = useParams()
  const decodedId = decodeURIComponent(compoundId)

  const [library,  setLibrary]  = useState(null)
  const [compound, setCompound] = useState(null)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    fetch(`/data/libraries/${libId}.json`)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })
      .then(lib => {
        setLibrary(lib)
        const c = lib.compounds.find(c => c.id === decodedId)
        if (!c) throw new Error(`Compound "${decodedId}" not found in library "${libId}"`)
        setCompound(c)
      })
      .catch(e => setError(e.message))
  }, [libId, decodedId])

  if (error) return (
    <main className="detail-page">
      <div className="page-container">
        <p className="error-msg">{error}</p>
        <Link to={`/library/${libId}`} className="back-link">← Back to library</Link>
      </div>
    </main>
  )

  if (!library || !compound) return (
    <main className="detail-page">
      <div className="page-container"><p className="loading-msg">Loading…</p></div>
    </main>
  )

  // Build building-block lookup
  const bbLookup = {}
  for (const [posKey, bbs] of Object.entries(library.building_blocks)) {
    bbLookup[posKey] = {}
    for (const bb of bbs) bbLookup[posKey][bb.code] = bb
  }

  // Group properties for display
  const grouped = { qc: [], primary: {}, derived: [], replicate: [], descriptor: [] }
  for (const prop of library.properties) {
    if (prop.role === 'qc')       grouped.qc.push(prop)
    else if (prop.role === 'derived')   grouped.derived.push(prop)
    else if (prop.role === 'replicate') grouped.replicate.push(prop)
    else if (prop.role === 'descriptor') grouped.descriptor.push(prop)
    else {
      const g = prop.group ?? 'Other'
      if (!grouped.primary[g]) grouped.primary[g] = []
      grouped.primary[g].push(prop)
    }
  }

  return (
    <main className="detail-page">
      <div className="page-container">

        {/* ── Nav ── */}
        <Link to={`/library/${libId}`} className="back-link">← {library.title}</Link>

        {/* ── Header ── */}
        <div className="detail-header">
          <h1 className="compound-id">{compound.id}</h1>
          {library.doi && (
            <a href={`https://doi.org/${library.doi}`} target="_blank" rel="noreferrer" className="doi-link">
              {library.title} ↗
            </a>
          )}
        </div>

        {/* ── Building blocks ── */}
        <section className="detail-section">
          <h2>Building Blocks</h2>
          <div className="bb-grid">
            {library.positions.map(pos => {
              const bb = bbLookup[pos.key]?.[compound.blocks[pos.key]]
              return bb
                ? <BBCard key={pos.key} positionLabel={pos.label} bb={bb} size="lg" />
                : <div key={pos.key} className="bb-card-missing">
                    <span className="bb-pos-label-plain">{pos.label}</span>
                    <span>{compound.blocks[pos.key]}</span>
                  </div>
            })}
          </div>
        </section>

        {/* ── Properties ── */}
        <section className="detail-section">
          <h2>Properties</h2>
          <div className="props-tables">

            {grouped.qc.length > 0 && (
              <div className="props-group">
                <h3>QC / Synthesis</h3>
                <table className="props-table">
                  <tbody>
                    {grouped.qc.map(p => <PropRow key={p.key} prop={p} value={compound.props[p.key]} raw={compound.mic_raw} />)}
                  </tbody>
                </table>
              </div>
            )}

            {Object.entries(grouped.primary).map(([groupName, props]) => (
              <div key={groupName} className="props-group">
                <h3>{groupName}</h3>
                <table className="props-table">
                  <tbody>
                    {props.map(p => <PropRow key={p.key} prop={p} value={compound.props[p.key]} raw={compound.mic_raw} />)}
                    {grouped.replicate
                      .filter(p => (p.group ?? 'Other') === groupName)
                      .map(p => <PropRow key={p.key} prop={p} value={compound.props[p.key]} raw={compound.mic_raw} />)}
                  </tbody>
                </table>
              </div>
            ))}

            {/* Replicates whose group doesn't match any primary group */}
            {(() => {
              const primaryGroups = new Set(Object.keys(grouped.primary))
              const orphanReplicates = grouped.replicate.filter(p => !primaryGroups.has(p.group ?? 'Other'))
              return orphanReplicates.length > 0 && (
                <div className="props-group">
                  <h3>Replicates</h3>
                  <table className="props-table">
                    <tbody>
                      {orphanReplicates.map(p => <PropRow key={p.key} prop={p} value={compound.props[p.key]} raw={compound.mic_raw} />)}
                    </tbody>
                  </table>
                </div>
              )
            })()}

            {grouped.derived.length > 0 && (
              <div className="props-group">
                <h3>Derived</h3>
                <table className="props-table">
                  <tbody>
                    {grouped.derived.map(p => <PropRow key={p.key} prop={p} value={compound.props[p.key]} raw={compound.mic_raw} />)}
                  </tbody>
                </table>
              </div>
            )}

            {grouped.descriptor.length > 0 && (
              <div className="props-group">
                <h3>Descriptors (ligand-based)</h3>
                <table className="props-table">
                  <tbody>
                    {grouped.descriptor.map(p => <PropRow key={p.key} prop={p} value={compound.props[p.key]} raw={compound.mic_raw} />)}
                  </tbody>
                </table>
              </div>
            )}

          </div>
        </section>

        {/* ── 3D structure ── */}
        <section className="detail-section">
          <h2>3D Structure</h2>
          <ThreeDViewer libId={libId} compoundId={decodedId} />
        </section>

        {/* ── LC-MS chromatogram ── */}
        <section className="detail-section">
          <h2>LC-MS Chromatogram</h2>
          <LcmsViewer libId={libId} compoundId={decodedId} />
        </section>

      </div>
    </main>
  )
}
