import './Footer.css'

// Injected at build time (vite.config.js) — always reflects the actual build/
// deploy, not something that needs editing by hand on every push. Includes
// h:m:s, not just the date, since deploys currently happen several times a day.
const buildDate = new Date(__BUILD_DATE__).toLocaleString('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
})

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <span>
          <a href="https://www.thefreilab.com" target="_blank" rel="noreferrer">
            The Frei Lab
          </a>
          {' · '}University of York
        </span>
        <span className="footer-note">
          All data from published work · public &amp; read-only
        </span>
        <span className="footer-note">Last updated {buildDate}</span>
      </div>
    </footer>
  )
}
