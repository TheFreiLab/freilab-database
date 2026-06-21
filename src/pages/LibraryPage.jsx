import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import CompoundTable from '../components/CompoundTable'
import VizPanel from '../components/VizPanel'
import FilterPanel from '../components/FilterPanel'
import './LibraryPage.css'

function getPropAvg(compound, propKey) {
  const v = compound.props[propKey]
  if (v === null || v === undefined) return null
  return typeof v === 'object' ? v.avg : v
}

export default function LibraryPage() {
  const { id } = useParams()
  const [library,     setLibrary]     = useState(null)
  const [error,       setError]       = useState(null)
  const [view,        setView]        = useState('table')
  const [showFilters, setShowFilters] = useState(false)
  const [bbFilters,   setBBFilters]   = useState({})
  const [propFilters, setPropFilters] = useState({})

  useEffect(() => {
    setLibrary(null)
    setError(null)
    setView('table')
    setBBFilters({})
    setPropFilters({})
    setShowFilters(false)
    fetch(`/data/libraries/${id}.json`)
      .then(r => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json() })
      .then(setLibrary)
      .catch(e => setError(e.message))
  }, [id])

  const bbLookup = useMemo(() => {
    if (!library) return {}
    const map = {}
    for (const [posKey, bbs] of Object.entries(library.building_blocks)) {
      map[posKey] = {}
      for (const bb of bbs) map[posKey][bb.code] = bb
    }
    return map
  }, [library])

  const propRanges = useMemo(() => {
    if (!library) return {}
    const ranges = {}
    for (const prop of library.properties) {
      if (prop.role === 'replicate') continue
      let mn = Infinity, mx = -Infinity
      for (const c of library.compounds) {
        const v = getPropAvg(c, prop.key)
        if (v !== null && v !== undefined) {
          if (v < mn) mn = v
          if (v > mx) mx = v
        }
      }
      if (mn !== Infinity) ranges[prop.key] = { min: mn, max: mx }
    }
    return ranges
  }, [library])

  const activeFilterCount = useMemo(() => {
    let n = 0
    for (const v of Object.values(bbFilters))  if (v) n++
    for (const f of Object.values(propFilters)) {
      if (f.min !== '' && f.min != null) n++
      if (f.max !== '' && f.max != null) n++
    }
    return n
  }, [bbFilters, propFilters])

  const filteredCompounds = useMemo(() => {
    if (!library) return []
    let list = library.compounds

    for (const [posKey, code] of Object.entries(bbFilters)) {
      if (code) list = list.filter(c => c.blocks[posKey] === code)
    }
    for (const [propKey, f] of Object.entries(propFilters)) {
      if (f.min !== '' && f.min != null) {
        const minVal = parseFloat(f.min)
        list = list.filter(c => { const v = getPropAvg(c, propKey); return v !== null && v >= minVal })
      }
      if (f.max !== '' && f.max != null) {
        const maxVal = parseFloat(f.max)
        list = list.filter(c => { const v = getPropAvg(c, propKey); return v !== null && v <= maxVal })
      }
    }
    return list
  }, [library, bbFilters, propFilters])

  const handleBBFilter = useCallback((posKey, code) => {
    setBBFilters(prev => ({ ...prev, [posKey]: code }))
  }, [])

  const handlePropFilter = useCallback((propKey, bound, value) => {
    setPropFilters(prev => ({ ...prev, [propKey]: { ...(prev[propKey] ?? {}), [bound]: value } }))
  }, [])

  const clearFilters = useCallback(() => {
    setBBFilters({})
    setPropFilters({})
  }, [])

  if (error) return (
    <main className="library-page">
      <div className="page-container">
        <p className="error-msg">Could not load library "{id}": {error}</p>
        <Link to="/" className="back-link">← All libraries</Link>
      </div>
    </main>
  )

  if (!library) return (
    <main className="library-page">
      <div className="page-container">
        <p className="loading-msg">Loading library…</p>
      </div>
    </main>
  )

  const filteredLibrary = { ...library, compounds: filteredCompounds }

  return (
    <main className="library-page">
      <div className="page-container">
        <div className="lib-header">
          <Link to="/" className="back-link">← All libraries</Link>
          <h1>{library.title}</h1>
          <p className="lib-desc">{library.description}</p>
          <div className="lib-meta">
            <span>{library.compound_count ?? library.compounds.length} compounds</span>
            <span>{library.metal} · {library.scaffold}</span>
            {library.doi && (
              <a href={`https://doi.org/${library.doi}`} target="_blank" rel="noreferrer">
                DOI ↗
              </a>
            )}
          </div>
        </div>

        {/* ── Filter toggle + panel (shared across both tabs) ── */}
        <div className="filter-bar">
          <button
            className={`filter-toggle-btn${showFilters ? ' active' : ''}`}
            onClick={() => setShowFilters(v => !v)}
          >
            Filters
            {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
          </button>
          {activeFilterCount > 0 && !showFilters && (
            <span className="filter-active-hint">
              {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
              · {filteredCompounds.length.toLocaleString()} / {library.compounds.length.toLocaleString()} compounds
            </span>
          )}
        </div>

        {showFilters && (
          <FilterPanel
            positions={library.positions}
            bbLookup={bbLookup}
            bbFilters={bbFilters}
            onBBFilter={handleBBFilter}
            properties={library.properties}
            propFilters={propFilters}
            onPropFilter={handlePropFilter}
            propRanges={propRanges}
            onClear={clearFilters}
            activeCount={activeFilterCount}
          />
        )}

        {/* ── View tabs ── */}
        <div className="view-tabs">
          <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>Table</button>
          <button className={view === 'viz'   ? 'active' : ''} onClick={() => setView('viz')}>Visualisations</button>
        </div>

        {view === 'table' && <CompoundTable library={library} compounds={filteredCompounds} />}
        {view === 'viz'   && <VizPanel      library={filteredLibrary} />}
      </div>
    </main>
  )
}
