import { useState, useMemo } from 'react'
import './CompoundTable.css'

const PER_PAGE = 50

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
  const [search,  setSearch]  = useState('')
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [page,    setPage]    = useState(1)

  const { positions, properties, compounds } = library

  // Column definitions derived from the library schema — nothing hardcoded
  const columns = useMemo(() => [
    { key: 'id', label: 'ID', type: 'id' },
    ...positions.map(p => ({ key: p.key, label: p.label, type: 'block' })),
    ...properties.map(p => ({ ...p, type: 'prop' })),
  ], [positions, properties])

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  const filtered = useMemo(() => {
    let list = compounds
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(c => c.id.toLowerCase().includes(q))
    if (sortKey) {
      list = [...list].sort((a, b) => {
        const av = getPropValue(a, sortKey, positions)
        const bv = getPropValue(b, sortKey, positions)
        if (av === null && bv === null) return 0
        if (av === null) return 1
        if (bv === null) return -1
        if (typeof av === 'string') return sortDir === 'asc'
          ? av.localeCompare(bv) : bv.localeCompare(av)
        return sortDir === 'asc' ? av - bv : bv - av
      })
    }
    return list
  }, [compounds, search, sortKey, sortDir, positions])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePage   = Math.min(page, totalPages)
  const pageSlice  = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)

  function onSearch(e) { setSearch(e.target.value); setPage(1) }

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
        <span className="result-count">
          {filtered.length.toLocaleString()} of {compounds.length.toLocaleString()} compounds
        </span>
      </div>

      {/* ── Table ── */}
      <div className="table-scroll">
        <table className="compound-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={[
                    col.type,
                    sortKey === col.key ? 'sorted' : '',
                  ].join(' ')}
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
              <tr key={compound.id}>
                {columns.map(col => {
                  if (col.key === 'id') return (
                    <td key="id" className="col-id">
                      <a href={`/compound/${library.id}/${compound.id}`}>
                        {compound.id}
                      </a>
                    </td>
                  )
                  if (col.type === 'block') return (
                    <td key={col.key} className="col-block">
                      {compound.blocks[col.key] ?? <span className="missing">—</span>}
                    </td>
                  )
                  // property column
                  const raw = compound.props[col.key]
                  const display = formatVal(raw, col)
                  return (
                    <td key={col.key} className="col-prop">
                      {display !== null
                        ? display
                        : <span className="missing">—</span>
                      }
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
          <button
            className="page-btn"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage === 1}
          >
            ← Prev
          </button>
          <span className="page-info">
            Page {safePage} of {totalPages}
          </span>
          <button
            className="page-btn"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
