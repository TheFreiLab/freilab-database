import './Footer.css'

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
      </div>
    </footer>
  )
}
