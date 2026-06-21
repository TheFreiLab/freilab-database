import './FilterPanel.css'

export default function FilterPanel({
  positions, bbLookup,
  bbFilters, onBBFilter,
  properties, propFilters, onPropFilter,
  propRanges, onClear, activeCount,
}) {
  const filterableProps = properties.filter(p => p.role !== 'replicate')

  return (
    <div className="filter-panel">

      {/* ── Building blocks ── */}
      <div className="filter-section">
        <span className="filter-section-label">Building blocks</span>
        <div className="filter-bb-row">
          {positions.map(pos => {
            const options = bbLookup[pos.key] ? Object.values(bbLookup[pos.key]) : []
            return (
              <label key={pos.key} className="filter-bb-group">
                <span className="filter-pos-label">{pos.label}</span>
                <select
                  className="filter-select"
                  value={bbFilters[pos.key] ?? ''}
                  onChange={e => onBBFilter(pos.key, e.target.value)}
                >
                  <option value="">All</option>
                  {options.map(bb => (
                    <option key={bb.code} value={bb.code}>{bb.code}</option>
                  ))}
                </select>
              </label>
            )
          })}
        </div>
      </div>

      {/* ── Properties ── */}
      <div className="filter-section">
        <span className="filter-section-label">Property ranges</span>
        <div className="filter-props-grid">
          {filterableProps.map(prop => {
            const range = propRanges[prop.key]
            const f = propFilters[prop.key] ?? {}
            const fmt = v => v == null ? '' : (Math.abs(v) < 10 ? v.toFixed(2) : v.toFixed(1))
            return (
              <div key={prop.key} className="filter-prop-group">
                <span className="filter-prop-label">
                  {prop.label}
                  {prop.unit ? <span className="filter-prop-unit"> ({prop.unit})</span> : null}
                </span>
                <div className="filter-prop-inputs">
                  <input
                    type="number"
                    className="filter-range-input"
                    placeholder={range ? fmt(range.min) : 'min'}
                    value={f.min ?? ''}
                    onChange={e => onPropFilter(prop.key, 'min', e.target.value)}
                    step="any"
                  />
                  <span className="filter-dash">–</span>
                  <input
                    type="number"
                    className="filter-range-input"
                    placeholder={range ? fmt(range.max) : 'max'}
                    value={f.max ?? ''}
                    onChange={e => onPropFilter(prop.key, 'max', e.target.value)}
                    step="any"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {activeCount > 0 && (
        <div className="filter-footer">
          <button className="filter-clear-btn" onClick={onClear}>
            Clear all filters ({activeCount} active)
          </button>
        </div>
      )}
    </div>
  )
}
