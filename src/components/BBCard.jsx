import './BBCard.css'

/**
 * Displays a single building block: position label, code, and 2D SVG.
 * size: 'sm' (popover) | 'lg' (detail page)
 */
export default function BBCard({ positionLabel, bb, size = 'sm' }) {
  return (
    <div className={`bb-card bb-card--${size}`}>
      <span className="bb-pos-label">{positionLabel}</span>
      <span className="bb-code">{bb.code}</span>
      {bb.svg
        ? <div
            className="bb-svg"
            dangerouslySetInnerHTML={{ __html: bb.svg }}
          />
        : <div className="bb-svg bb-svg--placeholder">
            {bb.name ?? bb.code}
          </div>
      }
    </div>
  )
}
