import './LibraryGrid.css'

export default function MetricSwitcher({ metrics, activeKey, onChange }) {
  return (
    <div className="metric-switcher" role="group" aria-label="Colour metric">
      {metrics.map(m => (
        <button
          key={m.key}
          className={`metric-btn${activeKey === m.key ? ' active' : ''}`}
          onClick={() => onChange(m.key)}
          aria-pressed={activeKey === m.key}
        >
          {m.label}
          {m.unit && <span className="metric-unit"> {m.unit}</span>}
        </button>
      ))}
    </div>
  )
}
