import { useState, useEffect } from 'react'
import LibraryCard from '../components/LibraryCard'
import './Home.css'

export default function Home() {
  const [manifest, setManifest] = useState(null)
  const [error, setError]       = useState(null)

  useEffect(() => {
    fetch('/data/manifest.json')
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json() })
      .then(setManifest)
      .catch(e => setError(e.message))
  }, [])

  return (
    <main className="home-page">
      <div className="page-container">
        <div className="page-header">
          <h1>Compound Libraries</h1>
          <p className="lead">
            Searchable, filterable screening data from the Frei Lab's
            combinatorial metal-complex libraries.
          </p>
        </div>

        {error && <p className="error-msg">Failed to load libraries: {error}</p>}

        {!manifest && !error && (
          <p className="loading-msg">Loading…</p>
        )}

        {manifest && (
          <div className="library-grid">
            {manifest.libraries.map(lib => (
              <LibraryCard key={lib.id} library={lib} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
