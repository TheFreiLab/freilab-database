import { Link, NavLink } from 'react-router-dom'
import './Header.css'

export default function Header() {
  return (
    <header className="site-header">
      <nav className="nav-inner">
        <Link to="/" className="site-logo-link">
          <img src="/logo.png" alt="Frei Lab" className="site-logo" />
          <span className="site-subtitle">Compound Database</span>
        </Link>
        <ul className="nav-links">
          <li><NavLink to="/" end>Libraries</NavLink></li>
          <li>
            <a href="https://www.thefreilab.com" target="_blank" rel="noreferrer">
              Lab Website ↗
            </a>
          </li>
        </ul>
      </nav>
    </header>
  )
}
