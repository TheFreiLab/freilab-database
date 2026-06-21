import { Link, NavLink } from 'react-router-dom'
import './Header.css'

export default function Header() {
  return (
    <header className="site-header">
      <nav className="nav-inner">
        <Link to="/" className="site-title">
          Frei Lab &middot; Compound Database
        </Link>
        <ul className="nav-links">
          <li><NavLink to="/" end>Libraries</NavLink></li>
        </ul>
      </nav>
    </header>
  )
}
