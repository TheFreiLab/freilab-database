import { useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { PALETTE, getMetricColor } from '../../theme/palette'
import { computeRange } from '../../data/vizAdapter'

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

export function computeLayout(numRows, numCols, isSmall = false) {
  const maxW    = isSmall ? 280 : 680
  const cellW   = Math.max(isSmall ? 28 : 30, Math.min(isSmall ? 52 : 52, Math.floor((maxW - 80) / numCols)))
  const cellH   = Math.max(14, Math.min(24, Math.round(cellW * 0.55)))
  const LABEL_W = 50
  const MBAR_W  = 26   // row marginal bar strip width
  const MBAR_H  = 30   // col marginal bar strip height
  const COL_LH  = 58   // col label area height
  const cellsLeft = LABEL_W + MBAR_W
  const cellsTop  = MBAR_H
  return {
    cellW, cellH, LABEL_W, MBAR_W, MBAR_H, COL_LH,
    cellsLeft, cellsTop,
    canvasW: cellsLeft + numCols * cellW + 2,
    canvasH: cellsTop  + numRows * cellH + COL_LH,
  }
}

function drawHatch(ctx, x, y, w, h) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  ctx.strokeStyle = '#C8CDD0'
  ctx.lineWidth = 0.8
  const step = 5
  for (let d = -h; d < w + h; d += step) {
    ctx.beginPath()
    ctx.moveTo(x + d, y)
    ctx.lineTo(x + d + h, y + h)
    ctx.stroke()
  }
  ctx.restore()
}

function drawBackground(ctx, layout, rowCodes, colCodes, compounds, metric, range,
                        rowAgg, colAgg, maxRowAgg, maxColAgg, highlightRow, highlightCol) {
  const { cellW, cellH, LABEL_W, MBAR_W, MBAR_H, COL_LH, cellsLeft, cellsTop } = layout
  const canvasW = cellsLeft + colCodes.length * cellW + 2
  const canvasH = cellsTop + rowCodes.length * cellH + COL_LH

  ctx.clearRect(0, 0, canvasW, canvasH)

  // Build lookup
  const lookup = {}
  for (const c of compounds) lookup[`${c._row}|${c._col}`] = c

  // ── Grid cells ──
  for (let ri = 0; ri < rowCodes.length; ri++) {
    for (let ci = 0; ci < colCodes.length; ci++) {
      const x = cellsLeft + ci * cellW
      const y = cellsTop  + ri * cellH
      const compound = lookup[`${rowCodes[ri]}|${colCodes[ci]}`]
      const value = compound ? metric.getValue(compound) : null

      if (value === null || value === undefined) {
        ctx.fillStyle = PALETTE.missing
        ctx.fillRect(x, y, cellW, cellH)
        drawHatch(ctx, x, y, cellW, cellH)
      } else {
        ctx.fillStyle = getMetricColor(value, range.min, range.max, metric.scale, { reverse: metric.reverse, log: metric.log })
        ctx.fillRect(x, y, cellW, cellH)
      }

      // Dim non-highlighted rows/cols
      if ((highlightRow || highlightCol) && rowCodes[ri] !== highlightRow && colCodes[ci] !== highlightCol) {
        ctx.fillStyle = PALETTE.dimOverlay
        ctx.fillRect(x, y, cellW, cellH)
      }

      // Cell border
      ctx.strokeStyle = PALETTE.gridline
      ctx.lineWidth = 0.5
      ctx.strokeRect(x + 0.25, y + 0.25, cellW - 0.5, cellH - 0.5)
    }
  }

  // ── Row labels ──
  ctx.fillStyle = PALETTE.text
  ctx.font = `10px ${FONT}`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let ri = 0; ri < rowCodes.length; ri++) {
    const y = cellsTop + ri * cellH + cellH / 2
    ctx.fillStyle = highlightRow === rowCodes[ri] ? PALETTE.text : (highlightRow ? PALETTE.mutedText : PALETTE.text)
    ctx.fillText(rowCodes[ri], LABEL_W - 4, y)
  }

  // ── Row marginal bars ──
  if (maxRowAgg > 0) {
    for (let ri = 0; ri < rowCodes.length; ri++) {
      const v = rowAgg[rowCodes[ri]]
      if (v === null) continue
      const barW = Math.round((v / maxRowAgg) * (MBAR_W - 4))
      const y = cellsTop + ri * cellH + 2
      const isHL = highlightRow === rowCodes[ri]
      ctx.fillStyle = isHL ? '#0072B2' : '#6BAEC8'
      ctx.fillRect(LABEL_W + 1, y, barW, cellH - 4)
    }
  }

  // ── Col marginal bars ──
  if (maxColAgg > 0) {
    for (let ci = 0; ci < colCodes.length; ci++) {
      const v = colAgg[colCodes[ci]]
      if (v === null) continue
      const barH = Math.round((v / maxColAgg) * (MBAR_H - 6))
      const x = cellsLeft + ci * cellW + 2
      const isHL = highlightCol === colCodes[ci]
      ctx.fillStyle = isHL ? '#0072B2' : '#6BAEC8'
      ctx.fillRect(x, MBAR_H - barH - 1, cellW - 4, barH)
    }
  }

  // ── Col labels (rotated) ──
  ctx.fillStyle = PALETTE.text
  ctx.font = `10px ${FONT}`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let ci = 0; ci < colCodes.length; ci++) {
    const cx = cellsLeft + ci * cellW + cellW / 2
    const cy = cellsTop + rowCodes.length * cellH + 4
    ctx.save()
    ctx.fillStyle = highlightCol === colCodes[ci] ? PALETTE.text : (highlightCol ? PALETTE.mutedText : PALETTE.text)
    ctx.translate(cx, cy)
    ctx.rotate(-Math.PI / 3)
    ctx.fillText(colCodes[ci], 0, 0)
    ctx.restore()
  }
}

function drawOverlay(ctx, layout, rowCodes, colCodes, hoveredCell, pinnedCell) {
  const { cellW, cellH, cellsLeft, cellsTop } = layout
  ctx.clearRect(0, 0, 9999, 9999)
  for (const cell of [pinnedCell, hoveredCell]) {
    if (!cell) continue
    const ri = rowCodes.indexOf(cell._row)
    const ci = colCodes.indexOf(cell._col)
    if (ri < 0 || ci < 0) continue
    const x = cellsLeft + ci * cellW
    const y = cellsTop  + ri * cellH
    const isPinned = cell === pinnedCell && cell !== hoveredCell
    ctx.strokeStyle = isPinned ? '#1A1A1A' : '#F5C518'
    ctx.lineWidth = isPinned ? 2 : 2
    ctx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2)
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GridCanvas({
  compounds, rowCodes, colCodes, metric, range,
  rowAgg, colAgg, highlightRow, highlightCol,
  hoveredCell, pinnedCell,
  onHover, onPin, onMarginalClick,
  isSmall = false,
}) {
  const bgRef  = useRef(null)
  const fgRef  = useRef(null)
  const layout = computeLayout(rowCodes.length, colCodes.length, isSmall)
  const layoutRef = useRef(layout)
  useLayoutEffect(() => { layoutRef.current = layout })

  const maxRowAgg = Math.max(0, ...Object.values(rowAgg).filter(v => v !== null))
  const maxColAgg = Math.max(0, ...Object.values(colAgg).filter(v => v !== null))

  // ── Background (full redraw on data/metric/sort/highlight change) ──
  useEffect(() => {
    const canvas = bgRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const L = layoutRef.current
    canvas.width  = L.canvasW * dpr
    canvas.height = L.canvasH * dpr
    canvas.style.width  = L.canvasW + 'px'
    canvas.style.height = L.canvasH + 'px'
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    drawBackground(ctx, L, rowCodes, colCodes, compounds, metric, range,
                   rowAgg, colAgg, maxRowAgg, maxColAgg, highlightRow, highlightCol)
  }, [compounds, rowCodes, colCodes, metric, range, rowAgg, colAgg, maxRowAgg, maxColAgg, highlightRow, highlightCol])

  // ── Overlay (hover + pin highlight) ──
  useEffect(() => {
    const canvas = fgRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const L = layoutRef.current
    canvas.width  = L.canvasW * dpr
    canvas.height = L.canvasH * dpr
    canvas.style.width  = L.canvasW + 'px'
    canvas.style.height = L.canvasH + 'px'
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    drawOverlay(ctx, L, rowCodes, colCodes, hoveredCell, pinnedCell)
  }, [hoveredCell, pinnedCell, rowCodes, colCodes])

  // ── Mouse handling ──
  const handleMouseMove = useCallback((e) => {
    const L = layoutRef.current
    const rect = fgRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const ci = Math.floor((mx - L.cellsLeft) / L.cellW)
    const ri = Math.floor((my - L.cellsTop)  / L.cellH)

    // Check col marginal click area
    if (my < L.cellsTop && mx >= L.cellsLeft && ci >= 0 && ci < colCodes.length) {
      return // handled on click
    }
    if (mx < L.cellsLeft && my >= L.cellsTop && ri >= 0 && ri < rowCodes.length) {
      return // handled on click (row marginal area)
    }

    if (ci >= 0 && ci < colCodes.length && ri >= 0 && ri < rowCodes.length) {
      const lookup = {}
      for (const c of compounds) lookup[`${c._row}|${c._col}`] = c
      onHover(lookup[`${rowCodes[ri]}|${colCodes[ci]}`] ?? null, e.clientX, e.clientY)
    } else {
      onHover(null)
    }
  }, [compounds, rowCodes, colCodes, onHover])

  const handleMouseLeave = useCallback(() => onHover(null), [onHover])

  const handleClick = useCallback((e) => {
    const L = layoutRef.current
    const rect = fgRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const ci = Math.floor((mx - L.cellsLeft) / L.cellW)
    const ri = Math.floor((my - L.cellsTop)  / L.cellH)

    // Marginal bar clicks
    if (my < L.cellsTop && mx >= L.cellsLeft && ci >= 0 && ci < colCodes.length) {
      onMarginalClick('col', colCodes[ci]); return
    }
    if (mx < L.cellsLeft + L.MBAR_W && my >= L.cellsTop && ri >= 0 && ri < rowCodes.length) {
      onMarginalClick('row', rowCodes[ri]); return
    }

    if (ci >= 0 && ci < colCodes.length && ri >= 0 && ri < rowCodes.length) {
      const lookup = {}
      for (const c of compounds) lookup[`${c._row}|${c._col}`] = c
      onPin(lookup[`${rowCodes[ri]}|${colCodes[ci]}`] ?? null)
    }
  }, [compounds, rowCodes, colCodes, onPin, onMarginalClick])

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas ref={bgRef} />
      <canvas
        ref={fgRef}
        style={{ position: 'absolute', top: 0, left: 0, cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      />
    </div>
  )
}
