import { useState, useEffect } from 'react'

export default function LcmsViewer({ libId, compoundId, className = '' }) {
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    setStatus('loading')
  }, [libId, compoundId])

  const src = `/data/lcms/${libId}/${encodeURIComponent(compoundId)}.svg`

  return (
    <div className={className}>
      {status === 'loading' && (
        <p style={{ color: '#6b7280', fontSize: '0.88rem' }}>Checking for LC-MS chromatogram…</p>
      )}
      {status === 'not-found' && (
        <p style={{ color: '#6b7280', fontSize: '0.88rem', fontStyle: 'italic' }}>No LC-MS chromatogram available.</p>
      )}
      <img
        src={src}
        alt={`LC-MS chromatogram for ${compoundId}`}
        style={{
          display: status === 'found' ? 'block' : 'none',
          width: '100%',
          maxWidth: 720,
          border: '1px solid #e5e7eb',
          borderRadius: 6,
        }}
        onLoad={() => setStatus('found')}
        onError={() => setStatus('not-found')}
      />
    </div>
  )
}
