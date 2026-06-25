import './PeriodicTableMini.css'

// Standard 18-group layout. period 6/7 group-3 slots are intentionally blank —
// La-Lu and Ac-Lr are shown in full as the two f-block rows below instead of
// being split between the main body and the strip.
const ELEMENTS = [
  ['H', 1, 1], ['He', 1, 18],
  ['Li', 2, 1], ['Be', 2, 2], ['B', 2, 13], ['C', 2, 14], ['N', 2, 15], ['O', 2, 16], ['F', 2, 17], ['Ne', 2, 18],
  ['Na', 3, 1], ['Mg', 3, 2], ['Al', 3, 13], ['Si', 3, 14], ['P', 3, 15], ['S', 3, 16], ['Cl', 3, 17], ['Ar', 3, 18],
  ['K', 4, 1], ['Ca', 4, 2], ['Sc', 4, 3], ['Ti', 4, 4], ['V', 4, 5], ['Cr', 4, 6], ['Mn', 4, 7], ['Fe', 4, 8],
  ['Co', 4, 9], ['Ni', 4, 10], ['Cu', 4, 11], ['Zn', 4, 12], ['Ga', 4, 13], ['Ge', 4, 14], ['As', 4, 15], ['Se', 4, 16], ['Br', 4, 17], ['Kr', 4, 18],
  ['Rb', 5, 1], ['Sr', 5, 2], ['Y', 5, 3], ['Zr', 5, 4], ['Nb', 5, 5], ['Mo', 5, 6], ['Tc', 5, 7], ['Ru', 5, 8],
  ['Rh', 5, 9], ['Pd', 5, 10], ['Ag', 5, 11], ['Cd', 5, 12], ['In', 5, 13], ['Sn', 5, 14], ['Sb', 5, 15], ['Te', 5, 16], ['I', 5, 17], ['Xe', 5, 18],
  ['Cs', 6, 1], ['Ba', 6, 2], ['Hf', 6, 4], ['Ta', 6, 5], ['W', 6, 6], ['Re', 6, 7], ['Os', 6, 8],
  ['Ir', 6, 9], ['Pt', 6, 10], ['Au', 6, 11], ['Hg', 6, 12], ['Tl', 6, 13], ['Pb', 6, 14], ['Bi', 6, 15], ['Po', 6, 16], ['At', 6, 17], ['Rn', 6, 18],
  ['Fr', 7, 1], ['Ra', 7, 2], ['Rf', 7, 4], ['Db', 7, 5], ['Sg', 7, 6], ['Bh', 7, 7], ['Hs', 7, 8],
  ['Mt', 7, 9], ['Ds', 7, 10], ['Rg', 7, 11], ['Cn', 7, 12], ['Nh', 7, 13], ['Fl', 7, 14], ['Mc', 7, 15], ['Lv', 7, 16], ['Ts', 7, 17], ['Og', 7, 18],
]

const LANTHANIDES = ['La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu']
const ACTINIDES =   ['Ac', 'Th', 'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm', 'Md', 'No', 'Lr']
const F_BLOCK_START_COL = 3 // visually offset under the d-block, standard convention

const CELL = 11
const GAP = 1.5
const STEP = CELL + GAP

function x(col) { return (col - 1) * STEP }
function y(row) { return (row - 1) * STEP }

export default function PeriodicTableMini({ highlight = [] }) {
  const highlightSet = new Set(highlight)
  const width = 18 * STEP - GAP
  const fBlockTop = 7 * STEP + STEP * 0.6
  const height = fBlockTop + 2 * STEP

  function cell(symbol, cx, cy) {
    const isHighlighted = highlightSet.has(symbol)
    return (
      <g key={symbol} transform={`translate(${cx},${cy})`}>
        <rect
          width={CELL} height={CELL} rx={1.5}
          className={isHighlighted ? 'ptm-cell ptm-cell-highlight' : 'ptm-cell'}
        />
        {isHighlighted && (
          <text x={CELL / 2} y={CELL / 2} className="ptm-label" textAnchor="middle" dominantBaseline="central">
            {symbol}
          </text>
        )}
      </g>
    )
  }

  return (
    <svg className="ptm-svg" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="Periodic table showing the metals covered by this database">
      {ELEMENTS.map(([symbol, period, group]) => cell(symbol, x(group), y(period)))}
      {LANTHANIDES.map((symbol, i) => cell(symbol, x(F_BLOCK_START_COL + i), fBlockTop))}
      {ACTINIDES.map((symbol, i) => cell(symbol, x(F_BLOCK_START_COL + i), fBlockTop + STEP))}
    </svg>
  )
}
