import './Home.css'

export default function Home() {
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
        <div className="library-grid-placeholder">
          <p>Libraries will appear here — coming in Stage 2.</p>
        </div>
      </div>
    </main>
  )
}
