import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import BBCard from '../components/BBCard'
import './CompoundDetailPage.css'

// ── Property value formatting ────────────────────────────────────────────────

function fmtNum(n, unit) {
  if (n === null || n === undefined) return null
  if (unit === '%')   return `${n.toFixed(1)} %`
  if (unit === 'min') return `${n.toFixed(3)} min`
  if (unit === 'OD')  return n.toFixed(4)
  if (unit === 'µM')  return `${n.toFixed(2)} µM`
  return n.toFixed(2)
}

function PropRow({ prop, value }) {
  const isObj = value !== null && typeof value === 'object'
  const avg   = isObj ? value.avg  : value
  const reps  = isObj ? value.reps : null
  const sd    = isObj ? value.sd   : null

  const displayAvg = fmtNum(avg, prop.unit)

  return (
    <tr className="prop-row">
      <td className="prop-label">{prop.label}</td>
      <td className="prop-value">
        {displayAvg !== null
          ? <span className="prop-avg">{displayAvg}</span>
          : <span className="missing">—</span>
        }
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

// ── 3D viewer ────────────────────────────────────────────────────────────────

function ThreeDViewer({ libId, compoundId }) {
  const containerRef = useRef(null)
  const [status, setStatus] = useState('loading') // loading | found | not-found

  useEffect(() => {
    const url = `/data/xyz/${libId}/${encodeURIComponent(compoundId)}.xyz`
    fetch(url)
      .then(r => { if (!r.ok) throw new Error('not found'); return r.text() })
      .then(xyz => {
        setStatus('found')
        // Load 3Dmol.js lazily
        const existing = document.getElementById('3dmol-script')
        const init = () => {
          const viewer = window.$3Dmol.createViewer(containerRef.current, { backgroundColor: 'white' })
          viewer.addModel(xyz, 'xyz')
          viewer.setStyle({}, { stick: { radius: 0.15 }, sphere: { scale: 0.25 } })
          viewer.zoomTo()
          viewer.render()
        }
        if (window.$3Dmol) {
          init()
        } else {
          const script   = document.createElement('script')
          script.id      = '3dmol-script'
          script.src     = 'https://3dmol.org/build/3Dmol-min.js'
          script.onload  = init
          document.head.appendChild(script)
        }
      })
      .catch(() => setStatus('not-found'))
  }, [libId, compoundId])

  if (status === 'loading') return <p className="viewer-msg">Checking for 3D structure…</p>
  if (status === 'not-found') return <p className="viewer-msg viewer-msg--none">No 3D structure available for this compound.</p>
  return <div ref={containerRef} className="mol-viewer" />
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
  const grouped = { qc: [], primary: {}, derived: [], replicate: [] }
  for (const prop of library.properties) {
    if (prop.role === 'qc')       grouped.qc.push(prop)
    else if (prop.role === 'derived')   grouped.derived.push(prop)
    else if (prop.role === 'replicate') grouped.replicate.push(prop)
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
                    {grouped.qc.map(p => <PropRow key={p.key} prop={p} value={compound.props[p.key]} />)}
                  </tbody>
                </table>
              </div>
            )}

            {Object.entries(grouped.primary).map(([groupName, props]) => (
              <div key={groupName} className="props-group">
                <h3>{groupName}</h3>
                <table className="props-table">
                  <tbody>
                    {props.map(p => <PropRow key={p.key} prop={p} value={compound.props[p.key]} />)}
                    {grouped.replicate.map(p => <PropRow key={p.key} prop={p} value={compound.props[p.key]} />)}
                  </tbody>
                </table>
              </div>
            ))}

            {grouped.derived.length > 0 && (
              <div className="props-group">
                <h3>Derived</h3>
                <table className="props-table">
                  <tbody>
                    {grouped.derived.map(p => <PropRow key={p.key} prop={p} value={compound.props[p.key]} />)}
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

      </div>
    </main>
  )
}
