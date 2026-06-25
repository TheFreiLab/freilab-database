import { Link } from 'react-router-dom'
import './LibraryCard.css'

export default function LibraryCard({ library }) {
  // Was a <Link> (renders <a>) wrapping the DOI <a> — invalid nested-anchor HTML,
  // React hydration warning on every card. Now a plain div with a full-bleed
  // overlay Link for "click anywhere navigates", and the DOI link stacked above
  // it (a flex item, so z-index applies without needing position) so it's the
  // one exception that opens its own href instead.
  return (
    <div className="library-card">
      <Link to={`/library/${library.id}`} className="library-card-link" aria-label={library.title} />

      <div className="card-badges">
        <span className="badge badge-metal">{library.metal}</span>
        <span className="badge badge-scaffold">{library.scaffold}</span>
      </div>

      <h2 className="card-title">{library.title}</h2>
      <p className="card-desc">{library.description}</p>

      <div className="card-footer">
        <span>{library.compound_count.toLocaleString()} compounds</span>
        <span>{library.position_count} building-block positions</span>
        {library.doi && (
          <a
            href={`https://doi.org/${library.doi}`}
            target="_blank"
            rel="noreferrer"
            className="doi-link"
          >
            DOI ↗
          </a>
        )}
      </div>
    </div>
  )
}
