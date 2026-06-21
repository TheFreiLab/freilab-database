import { useState, useEffect, useRef } from 'react'

export default function ThreeDViewer({ libId, compoundId, className = '', height = 340 }) {
  const containerRef = useRef(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const url = `/data/xyz/${libId}/${encodeURIComponent(compoundId)}.xyz`
    let cancelled = false
    fetch(url)
      .then(r => { if (!r.ok) throw new Error('not found'); return r.text() })
      .then(xyz => {
        if (cancelled) return
        setStatus('found')
        const init = () => {
          if (cancelled || !containerRef.current) return
          const viewer = window.$3Dmol.createViewer(containerRef.current, { backgroundColor: 'white' })
          viewer.addModel(xyz, 'xyz')
          viewer.setStyle({}, { stick: { radius: 0.15 }, sphere: { scale: 0.25 } })
          viewer.zoomTo()
          viewer.render()
        }
        if (window.$3Dmol) {
          init()
        } else if (!document.getElementById('3dmol-script')) {
          const script = document.createElement('script')
          script.id = '3dmol-script'
          script.src = 'https://3dmol.org/build/3Dmol-min.js'
          script.onload = init
          document.head.appendChild(script)
        } else {
          // Script tag exists but not yet loaded — wait for it
          document.getElementById('3dmol-script').addEventListener('load', init)
        }
      })
      .catch(() => { if (!cancelled) setStatus('not-found') })
    return () => { cancelled = true }
  }, [libId, compoundId])

  if (status === 'loading')   return <p style={{ color: '#6b7280', fontSize: '0.88rem' }}>Checking for 3D structure…</p>
  if (status === 'not-found') return <p style={{ color: '#6b7280', fontSize: '0.88rem', fontStyle: 'italic' }}>No 3D structure available.</p>
  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height, border: '1px solid #e5e7eb', borderRadius: 6, position: 'relative' }}
    />
  )
}
