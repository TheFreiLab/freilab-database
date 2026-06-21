import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import LibraryPage from './pages/LibraryPage'
import CompoundDetailPage from './pages/CompoundDetailPage'
import './index.css'

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/library/:id" element={<LibraryPage />} />
        <Route path="/compound/:libId/:compoundId" element={<CompoundDetailPage />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  )
}
