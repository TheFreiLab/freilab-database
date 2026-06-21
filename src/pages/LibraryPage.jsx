import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import CompoundTable from '../components/CompoundTable'
import VizPanel from '../components/VizPanel'
import './LibraryPage.css'

export default function LibraryPage() {
  const { id } = useParams()
  const [library, setLibrary] = useState(null)
  const [error,   setError]   = useState(null)
  const [view,    setView]    = useState('table')

  useEffect(() => {
    setLibrary(null)
    setError(null)
    setView('table')
    fetch(`/data/libraries/${id}.json`)
      .then(r => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.json() })
      .then(setLibrary)
      .catch(e => setError(e.message))
  }, [id])

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

        <div className="view-tabs">
          <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>Table</button>
          <button className={view === 'viz'   ? 'active' : ''} onClick={() => setView('viz')}>Visualisations</button>
        </div>

        {view === 'table' && <CompoundTable library={library} />}
        {view === 'viz'   && <VizPanel      library={library} />}
      </div>
    </main>
  )
}
