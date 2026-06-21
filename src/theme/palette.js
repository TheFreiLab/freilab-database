// CVD-safe palette tokens — single source of truth.
// All colours are Okabe-Ito based; verify in deuteranopia / protanopia sim before publication.

export const PALETTE = {
  // ── Categorical: scaffolds ─────────────────────────────────────────────────
  scaffold: {
    IrCN:         '#0072B2',
    Re_CO3:       '#D55E00',
    Re_CO3_solv:  '#E8845A',
    Mn_CO3:       '#009E73',
    Mn_CO3_solv:  '#4EC9A4',
    RuCy_Tz4P:    '#CC79A7',
    RuCy_Tz1MP:   '#9B4E7B',
    Free_Tz4P:    '#56B4E9',
    Free_Tz1MP:   '#2E90C5',
  },

  // ── Categorical: Cp cores ──────────────────────────────────────────────────
  cp: {
    Cp1: '#56B4E9',
    Cp2: '#0072B2',
    Cp3: '#009E73',
    Cp4: '#E69F00',
  },

  // ── Sequential / diverging scales (5-stop arrays, t ∈ [0,1]) ──────────────
  scales: {
    // Conversion %: teal ramp, higher = better
    conv:       ['#EFF5F6', '#BFDDE2', '#80BAC6', '#3C8497', '#0C4E60'],
    // Antimicrobial activity (OD or MIC): wine ramp.
    // Apply reverse:true so low OD / low MIC → dark end.
    activity:   ['#F6E9F0', '#E0A8C5', '#C66A9B', '#983F72', '#5C1E46'],
    // Toxicity / viability (HEK293T %): diverging orange↔teal.
    // High % = safe = teal; low % = toxic = orange. Apply reverse:true for OD toxicity.
    tox:        ['#B85C1A', '#D88B4A', '#F0F0F0', '#6BAEC8', '#2E6F8E'],
    // Selectivity ratio / SDR: diverging orange↔teal, higher = more selective = teal
    selectivity:['#B85C1A', '#D88B4A', '#F0F0F0', '#6BAEC8', '#2E6F8E'],
  },

  // ── Chrome ─────────────────────────────────────────────────────────────────
  missing:    '#F2F4F5',
  gridline:   '#E3E8EA',
  text:       '#1F2A2E',
  mutedText:  '#6B7A80',
  highlight:  'rgba(255,220,0,0.35)',
  dimOverlay: 'rgba(255,255,255,0.55)',
}

// Display labels for scaffold codes (for axis labels / legends)
export const SCAFFOLD_LABELS = {
  IrCN:        'IrCN',
  Re_CO3:      'Re(CO)₃',
  Re_CO3_solv: 'Re(CO)₃ (solv.)',
  Mn_CO3:      'Mn(CO)₃',
  Mn_CO3_solv: 'Mn(CO)₃ (solv.)',
  RuCy_Tz4P:  'RuCy (Tz4P)',
  RuCy_Tz1MP: 'RuCy (Tz1MP)',
  Free_Tz4P:  'Free Tz4P',
  Free_Tz1MP: 'Free Tz1MP',
}

export const CP_LABELS = {
  Cp1: 'Cp* (Cp1)',
  Cp2: 'Biphenyl (Cp2)',
  Cp3: 'Bis-F-Ph (Cp3)',
  Cp4: 'Cyclohexyl (Cp4)',
}

// ── Colour math ───────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

export function interpolateColor(stops, t) {
  const clamped = Math.max(0, Math.min(1, t))
  const n = stops.length - 1
  const i = Math.min(Math.floor(clamped * n), n - 1)
  const f = clamped * n - i
  const [r1, g1, b1] = hexToRgb(stops[i])
  const [r2, g2, b2] = hexToRgb(stops[i + 1])
  return `rgb(${Math.round(r1 + (r2 - r1) * f)},${Math.round(g1 + (g2 - g1) * f)},${Math.round(b1 + (b2 - b1) * f)})`
}

export function getMetricColor(value, vMin, vMax, scaleKey, opts = {}) {
  const { reverse = false, log = false } = opts
  const stops = PALETTE.scales[scaleKey] ?? PALETTE.scales.conv
  let t
  if (log) {
    const lv   = Math.log(Math.max(value, 1e-6))
    const lmin = Math.log(Math.max(vMin,  1e-6))
    const lmax = Math.log(Math.max(vMax,  1e-6))
    t = lmax === lmin ? 0.5 : (lv - lmin) / (lmax - lmin)
  } else {
    t = vMax === vMin ? 0.5 : (value - vMin) / (vMax - vMin)
  }
  return interpolateColor(stops, reverse ? 1 - t : t)
}

export function getFacetColor(code, facetType) {
  if (facetType === 'cp') return PALETTE.cp[code] ?? '#999'
  return PALETTE.scaffold[code] ?? '#999'
}
