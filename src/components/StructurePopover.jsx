import { useEffect, useRef, useState } from 'react'
import BBCard from './BBCard'
import './StructurePopover.css'

export default function StructurePopover({ compound, anchorRect, positions, bbLookup, onMouseEnter, onMouseLeave }) {
  const ref  = useRef(null)
  const [style, setStyle] = useState({ visibility: 'hidden' })

  useEffect(() => {
    if (!ref.current || !anchorRect) return
    const el         = ref.current
    const popW       = el.offsetWidth  || 480
    const popH       = el.offsetHeight || 200
    const margin     = 10
    const spaceAbove = anchorRect.top - margin
    const spaceBelow = window.innerHeight - anchorRect.bottom - margin

    const top = spaceAbove >= popH
      ? anchorRect.top - popH - 6
      : anchorRect.bottom + 6

    const left = Math.max(
      margin,
      Math.min(anchorRect.left, window.innerWidth - popW - margin)
    )

    setStyle({ top, left, visibility: 'visible' })
  }, [anchorRect])

  const blocks = positions.map(pos => ({
    pos,
    bb: bbLookup[pos.key]?.[compound.blocks[pos.key]],
  }))

  return (
    <div
      ref={ref}
      className="structure-popover"
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="popover-header">{compound.id}</div>
      <div className="popover-blocks">
        {blocks.map(({ pos, bb }) =>
          bb
            ? <BBCard key={pos.key} positionLabel={pos.label} bb={bb} size="sm" />
            : <div key={pos.key} className="bb-missing">{pos.label}: {compound.blocks[pos.key]}</div>
        )}
      </div>
    </div>
  )
}
