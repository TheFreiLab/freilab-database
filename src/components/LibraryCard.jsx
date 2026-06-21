import { Link } from 'react-router-dom'
import './LibraryCard.css'

export default function LibraryCard({ library }) {
  return (
    <Link to={`/library/${library.id}`} className="library-card">
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
            onClick={e => e.stopPropagation()}
          >
            DOI ↗
          </a>
        )}
      </div>
    </Link>
  )
}
