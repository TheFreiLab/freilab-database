import { useState, useMemo, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import StructurePopover from './StructurePopover'
import FilterPanel from './FilterPanel'
import './CompoundTable.css'

const PAGE_SIZE_OPTIONS = [50, 100, 250, 'All']

// ── Helpers ──────────────────────────────────────────────────────────────────

function getPropValue(compound, colKey, positions) {
  if (colKey === 'id') return compound.id
  if (positions.some(p => p.key === colKey)) return compound.blocks[colKey] ?? null
  const val = compound.props[colKey]
  if (val === null || val === undefined) return null
  return typeof val === 'object' ? val.avg : val
}

function formatVal(raw, prop) {
  if (raw === null || raw === undefined) return null
  const n = typeof raw === 'object' ? raw.avg : raw
  if (n === null || n === undefined) return null
  if (prop.unit === '%')   return `${n.toFixed(1)}`
  if (prop.unit === 'min') return n.toFixed(3)
  if (prop.unit === 'OD')  return n.toFixed(4)
  return n.toFixed(2)
}

function SortIcon({ dir }) {
  if (!dir) return <span className="sort-icon sort-none">⇅</span>
  return <span className="sort-icon">{dir === 'asc' ? '↑' : '↓'}</span>
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CompoundTable({ library }) {
  const [search,      setSearch]      = useState('')
  const [sortKey,     setSortKey]     = useState(null)
  const [sortDir,     setSortDir]     = useState('asc')
  const [page,        setPage]        = useState(1)
  const [pageSize,    setPageSize]    = useState(50)
  const [showFilters, setShowFilters] = useState(false)
  const [bbFilters,   setBBFilters]   = useState({})   // { posKey: code | '' }
  const [propFilters, setPropFilters] = useState({})   // { propKey: { min, max } }

  // Hover-popover state
  const [hovered, setHovered]       = useState(null) // {compound, anchorRect}
  const leaveTimer                  = useRef(null)

  const { positions, properties, compounds } = library

  // O(1) lookup: positionKey → code → building-block object
  const bbLookup = useMemo(() => {
    const map = {}
    for (const [posKey, bbs] of Object.entries(library.building_blocks)) {
      map[posKey] = {}
      for (const bb of bbs) map[posKey][bb.code] = bb
    }
    return map
  }, [library.building_blocks])

  // Compute min/max for each numeric property across all compounds
  const propRanges = useMemo(() => {
    const ranges = {}
    for (const prop of properties) {
      if (prop.role === 'replicate') continue
      let mn = Infinity, mx = -Infinity
      for (const c of compounds) {
        const v = getPropValue(c, prop.key, positions)
        if (v !== null && v !== undefined) {
          if (v < mn) mn = v
          if (v > mx) mx = v
        }
      }
      if (mn !== Infinity) ranges[prop.key] = { min: mn, max: mx }
    }
    return ranges
  }, [compounds, properties, positions])

  const handleBBFilter = useCallback((posKey, code) => {
    setBBFilters(prev => ({ ...prev, [posKey]: code }))
    setPage(1)
  }, [])

  const handlePropFilter = useCallback((propKey, bound, value) => {
    setPropFilters(prev => ({
      ...prev,
      [propKey]: { ...(prev[propKey] ?? {}), [bound]: value },
    }))
    setPage(1)
  }, [])

  const clearFilters = useCallback(() => {
    setBBFilters({})
    setPropFilters({})
    setPage(1)
  }, [])

  const activeFilterCount = useMemo(() => {
    let n = 0
    for (const v of Object.values(bbFilters))   if (v) n++
    for (const f of Object.values(propFilters))  { if (f.min !== '' && f.min != null) n++; if (f.max !== '' && f.max != null) n++ }
    return n
  }, [bbFilters, propFilters])

  const columns = useMemo(() => [
    { key: 'id', label: 'ID', type: 'id' },
    ...positions.map(p => ({ key: p.key, label: p.label, type: 'block' })),
    ...properties.map(p => ({ ...p, type: 'prop' })),
  ], [positions, properties])

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
    setPage(1)
  }

  const filtered = useMemo(() => {
    let list = compounds

    // Text search
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(c => c.id.toLowerCase().includes(q))

    // BB filters
    for (const [posKey, code] of Object.entries(bbFilters)) {
      if (code) list = list.filter(c => c.blocks[posKey] === code)
    }

    // Property range filters
    for (const [propKey, f] of Object.entries(propFilters)) {
      if (f.min !== '' && f.min != null) {
        const minVal = parseFloat(f.min)
        list = list.filter(c => { const v = getPropValue(c, propKey, positions); return v !== null && v >= minVal })
      }
      if (f.max !== '' && f.max != null) {
        const maxVal = parseFloat(f.max)
        list = list.filter(c => { const v = getPropValue(c, propKey, positions); return v !== null && v <= maxVal })
      }
    }

    // Sort
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const av = getPropValue(a, sortKey, positions)
        const bv = getPropValue(b, sortKey, positions)
        if (av === null && bv === null) return 0
        if (av === null) return 1
        if (bv === null) return -1
        if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
        return sortDir === 'asc' ? av - bv : bv - av
      })
    }
    return list
  }, [compounds, search, bbFilters, propFilters, sortKey, sortDir, positions])

  const perPage    = pageSize === 'All' ? filtered.length : pageSize
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage   = Math.min(page, totalPages)
  const pageSlice  = filtered.slice((safePage - 1) * perPage, safePage * perPage)

  function onSearch(e) { setSearch(e.target.value); setPage(1) }

  function onPageSize(e) {
    const val = e.target.value === 'All' ? 'All' : Number(e.target.value)
    setPageSize(val)
    setPage(1)
  }

  // ── Hover handlers (delay prevents flicker when crossing cell boundaries) ──
  const handleRowEnter = useCallback((compound, e) => {
    clearTimeout(leaveTimer.current)
    setHovered({ compound, anchorRect: e.currentTarget.getBoundingClientRect() })
  }, [])

  const handleRowLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => setHovered(null), 80)
  }, [])

  const handlePopoverEnter = useCallback(() => {
    clearTimeout(leaveTimer.current)
  }, [])

  const handlePopoverLeave = useCallback(() => {
    setHovered(null)
  }, [])

  const compoundUrl = (id) =>
    `/compound/${library.id}/${encodeURIComponent(id)}`

  return (
    <div className="compound-table-wrap">
      {/* ── Controls ── */}
      <div className="table-controls">
        <input
          type="search"
          className="search-input"
          placeholder="Search by compound ID…"
          value={search}
          onChange={onSearch}
        />
        <button
          className={`filter-toggle-btn${showFilters ? ' active' : ''}`}
          onClick={() => setShowFilters(v => !v)}
        >
          Filters
          {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
        </button>
        <label className="page-size-label">
          Show
          <select className="page-size-select" value={pageSize} onChange={onPageSize}>
            {PAGE_SIZE_OPTIONS.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </label>
        <span className="result-count">
          {filtered.length.toLocaleString()} of {compounds.length.toLocaleString()} compounds
        </span>
      </div>

      {/* ── Filter panel ── */}
      {showFilters && (
        <FilterPanel
          positions={positions}
          bbLookup={bbLookup}
          bbFilters={bbFilters}
          onBBFilter={handleBBFilter}
          properties={properties}
          propFilters={propFilters}
          onPropFilter={handlePropFilter}
          propRanges={propRanges}
          onClear={clearFilters}
          activeCount={activeFilterCount}
        />
      )}

      {/* ── Table ── */}
      <div className="table-scroll">
        <table className="compound-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={[col.type, sortKey === col.key ? 'sorted' : ''].join(' ')}
                  onClick={() => handleSort(col.key)}
                >
                  <span className="th-inner">
                    {col.label}
                    {col.unit && <span className="col-unit">{col.unit}</span>}
                    <SortIcon dir={sortKey === col.key ? sortDir : null} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageSlice.map(compound => (
              <tr
                key={compound.id}
                onMouseEnter={(e) => handleRowEnter(compound, e)}
                onMouseLeave={handleRowLeave}
              >
                {columns.map(col => {
                  if (col.key === 'id') return (
                    <td key="id" className="col-id">
                      <Link to={compoundUrl(compound.id)}>{compound.id}</Link>
                    </td>
                  )
                  if (col.type === 'block') return (
                    <td key={col.key} className="col-block">
                      {compound.blocks[col.key] ?? <span className="missing">—</span>}
                    </td>
                  )
                  const raw     = compound.props[col.key]
                  const display = formatVal(raw, col)
                  return (
                    <td key={col.key} className="col-prop">
                      {display !== null ? display : <span className="missing">—</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
            {pageSlice.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="empty-row">
                  No compounds match "{search}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="pagination">
          <button className="page-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}>
            ← Prev
          </button>
          <span className="page-info">Page {safePage} of {totalPages}</span>
          <button className="page-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>
            Next →
          </button>
        </div>
      )}

      {/* ── Hover popover ── */}
      {hovered && (
        <StructurePopover
          compound={hovered.compound}
          anchorRect={hovered.anchorRect}
          positions={positions}
          bbLookup={bbLookup}
          onMouseEnter={handlePopoverEnter}
          onMouseLeave={handlePopoverLeave}
        />
      )}
    </div>
  )
}
