// Maps a library JSON object → array of GridConfig objects ready for LibraryGrid.
// All library-specific knowledge lives here; components stay generic.

function getPropAvg(v) {
  if (v === null || v === undefined) return null
  return typeof v === 'object' ? (v.avg ?? null) : v
}

export function naturalSort(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

// Ligand-based descriptors (Stage 7a) — aggregated over the organic building
// blocks per compound. Shared across all libraries as scatter axis options.
const LIGAND_DESCRIPTOR_AXES = [
  { key: 'lig_mw',     label: 'Σ Ligand MW (Da)',      getValue: c => getPropAvg(c.props.lig_mw),     log: false },
  { key: 'lig_tpsa',   label: 'Σ Ligand TPSA (Å²)',    getValue: c => getPropAvg(c.props.lig_tpsa),   log: false },
  { key: 'lig_logp',   label: 'Mean Ligand logP',      getValue: c => getPropAvg(c.props.lig_logp),   log: false },
  { key: 'lig_hbd',    label: 'Σ Ligand HBD',          getValue: c => getPropAvg(c.props.lig_hbd),    log: false },
  { key: 'lig_hba',    label: 'Σ Ligand HBA',          getValue: c => getPropAvg(c.props.lig_hba),    log: false },
  { key: 'lig_rotb',   label: 'Σ Ligand Rot. bonds',   getValue: c => getPropAvg(c.props.lig_rotb),   log: false },
  { key: 'lig_arring', label: 'Σ Ligand Arom. rings',  getValue: c => getPropAvg(c.props.lig_arring), log: false },
]

// Stage 7b — precomputed UMAP chemical-space embedding (compute_embedding.py).
// Exposed per-grid as `umapAxes` (fixed X/Y pair for the dedicated Chemical
// space tab), kept separate from `scatterAxes` so the free-roaming Scatter
// tab doesn't offer UMAP coordinates as selectable axes.
const UMAP_AXES = [
  { key: 'umap_x', label: 'UMAP 1', getValue: c => c.umap?.[0] ?? null, log: false },
  { key: 'umap_y', label: 'UMAP 2', getValue: c => c.umap?.[1] ?? null, log: false },
]

// ── Per-library grid configurations ──────────────────────────────────────────

const LIBRARY_CONFIGS = {

  IrCpSB: {
    facetType: 'cp',
    grids: [
      {
        id: 'ircpsb',
        seriesLabel: null,
        facetPosition:  'Cp',
        rowPosition:    'Amine',
        colPosition:    'Ald',
        facetDisplay:   'selector',
        compoundFilter: () => true,
        rowFilter:      null,
        colFilter:      null,
        facetFilter:    null,
        metrics: [
          {
            key: 'conversion', label: 'Conversion', unit: '%',
            scale: 'conv', reverse: false, log: false,
            getValue: c => getPropAvg(c.props.conversion),
          },
          {
            key: 'sa_50', label: 'S. aureus 50µM', unit: 'OD',
            scale: 'activity', reverse: true, log: false,
            getValue: c => getPropAvg(c.props.sa_50),
          },
          {
            key: 'sa_12', label: 'S. aureus 12.5µM', unit: 'OD',
            scale: 'activity', reverse: true, log: false,
            getValue: c => getPropAvg(c.props.sa_12),
          },
          {
            key: 'ec_50', label: 'E. coli 50µM', unit: 'OD',
            scale: 'activity', reverse: true, log: false,
            getValue: c => getPropAvg(c.props.ec_50),
          },
          {
            key: 'hek_50', label: 'HEK293T', unit: '%',
            scale: 'tox', reverse: false, log: false,
            getValue: c => getPropAvg(c.props.hek_50),
          },
          {
            key: 'ratio', label: 'Selectivity Ratio', unit: null,
            scale: 'selectivity', reverse: false, log: false,
            getValue: c => getPropAvg(c.props.ratio),
          },
        ],
        scatterAxes: [
          { key: 'sa_50',      label: 'S. aureus 50µM (OD)',  getValue: c => getPropAvg(c.props.sa_50),      log: false },
          { key: 'sa_12',      label: 'S. aureus 12.5µM (OD)', getValue: c => getPropAvg(c.props.sa_12),    log: false },
          { key: 'ec_50',      label: 'E. coli 50µM (OD)',    getValue: c => getPropAvg(c.props.ec_50),      log: false },
          { key: 'hek_50',     label: 'HEK293T (%)',          getValue: c => getPropAvg(c.props.hek_50),     log: false },
          { key: 'ratio',      label: 'Selectivity Ratio',    getValue: c => getPropAvg(c.props.ratio),      log: false },
          { key: 'conversion', label: 'Conversion (%)',       getValue: c => getPropAvg(c.props.conversion), log: false },
          { key: 'rt_target',  label: 'RT Target (min)',      getValue: c => getPropAvg(c.props.rt_target),  log: false },
          { key: 'rt_2plus',   label: 'RT 2+ (min)',          getValue: c => getPropAvg(c.props.rt_2plus),   log: false },
          ...LIGAND_DESCRIPTOR_AXES,
        ],
        umapAxes: UMAP_AXES,
        scatterDefaultX: 'sa_50',
        scatterDefaultY: 'hek_50',
      },
    ],
  },

  TzLib: {
    facetType: 'scaffold',
    grids: [
      {
        id: 'tzlib-my',
        seriesLabel: 'Tz4P series (M × Y)',
        facetPosition:  'Scaffold',
        rowPosition:    'Amine',
        colPosition:    'Alkyne',
        facetDisplay:   'small-multiples',
        compoundFilter: c => c.blocks.Amine?.startsWith('M'),
        rowFilter:      code => code.startsWith('M'),
        colFilter:      code => code.startsWith('Y'),
        facetFilter:    null,
        metrics: [
          {
            key: 'peak_pct', label: 'Conversion', unit: '%',
            scale: 'conv', reverse: false, log: false,
            getValue: c => getPropAvg(c.props.peak_pct),
          },
          {
            key: 'mic', label: 'MIC S. aureus', unit: 'µM',
            scale: 'activity', reverse: true, log: true,
            getValue: c => getPropAvg(c.props.mic),
          },
          {
            key: 'sdr', label: 'Selectivity (SDR)', unit: 'µM',
            scale: 'selectivity', reverse: false, log: false,
            getValue: c => getPropAvg(c.props.sdr),
          },
          {
            key: 'tox_avg', label: 'HEK293T growth', unit: '%',
            scale: 'tox', reverse: false, log: false,
            getValue: c => getPropAvg(c.props.tox_avg),
          },
        ],
        scatterAxes: [
          { key: 'mic',      label: 'MIC S. aureus (µM)', getValue: c => getPropAvg(c.props.mic),      log: true  },
          { key: 'tox_avg',  label: 'HEK293T growth (%)', getValue: c => getPropAvg(c.props.tox_avg),  log: false },
          { key: 'sdr',      label: 'Selectivity (SDR)',  getValue: c => getPropAvg(c.props.sdr),      log: false },
          { key: 'peak_pct', label: 'Conversion (%)',     getValue: c => getPropAvg(c.props.peak_pct), log: false },
          { key: 'rt',       label: 'RT (min)',           getValue: c => getPropAvg(c.props.rt),       log: false },
          ...LIGAND_DESCRIPTOR_AXES,
        ],
        umapAxes: UMAP_AXES,
        scatterDefaultX: 'mic',
        scatterDefaultY: 'tox_avg',
      },
      {
        id: 'tzlib-pa',
        seriesLabel: 'Tz1MP series (P × A)',
        facetPosition:  'Scaffold',
        rowPosition:    'Amine',
        colPosition:    'Alkyne',
        facetDisplay:   'small-multiples',
        compoundFilter: c => c.blocks.Amine?.startsWith('P'),
        rowFilter:      code => code.startsWith('P'),
        colFilter:      code => code.startsWith('A'),
        facetFilter:    null,
        metrics: [
          {
            key: 'peak_pct', label: 'Conversion', unit: '%',
            scale: 'conv', reverse: false, log: false,
            getValue: c => getPropAvg(c.props.peak_pct),
          },
          {
            key: 'tox_avg', label: 'HEK293T growth', unit: '%',
            scale: 'tox', reverse: false, log: false,
            getValue: c => getPropAvg(c.props.tox_avg),
          },
          {
            key: 'mic', label: 'MIC S. aureus', unit: 'µM',
            scale: 'activity', reverse: true, log: true,
            getValue: c => getPropAvg(c.props.mic),
          },
          {
            key: 'sdr', label: 'Selectivity (SDR)', unit: 'µM',
            scale: 'selectivity', reverse: false, log: false,
            getValue: c => getPropAvg(c.props.sdr),
          },
        ],
        scatterAxes: [
          { key: 'mic',      label: 'MIC S. aureus (µM)', getValue: c => getPropAvg(c.props.mic),      log: true  },
          { key: 'tox_avg',  label: 'HEK293T growth (%)', getValue: c => getPropAvg(c.props.tox_avg),  log: false },
          { key: 'sdr',      label: 'Selectivity (SDR)',  getValue: c => getPropAvg(c.props.sdr),      log: false },
          { key: 'peak_pct', label: 'Conversion (%)',     getValue: c => getPropAvg(c.props.peak_pct), log: false },
          { key: 'rt',       label: 'RT (min)',           getValue: c => getPropAvg(c.props.rt),       log: false },
          ...LIGAND_DESCRIPTOR_AXES,
        ],
        umapAxes: UMAP_AXES,
        scatterDefaultX: 'mic',
        scatterDefaultY: 'tox_avg',
      },
    ],
  },

  NOSB: {
    facetType: 'scaffold',
    grids: [
      {
        id: 'nosb',
        seriesLabel: null,
        facetPosition:  'Scaffold',
        rowPosition:    'Amine',
        colPosition:    'Aldehyde',
        facetDisplay:   'selector',
        compoundFilter: () => true,
        rowFilter:      null,
        colFilter:      null,
        facetFilter:    null,
        metrics: [
          {
            key: 'conversion', label: 'Conversion', unit: '%',
            scale: 'conv', reverse: false, log: false,
            getValue: c => getPropAvg(c.props.conversion),
          },
          {
            key: 'sa_50', label: 'S. aureus 50µM', unit: 'OD',
            scale: 'activity', reverse: true, log: false,
            getValue: c => getPropAvg(c.props.sa_50),
          },
          {
            key: 'sa_12', label: 'S. aureus 12.5µM', unit: 'OD',
            scale: 'activity', reverse: true, log: false,
            getValue: c => getPropAvg(c.props.sa_12),
          },
          {
            key: 'ec_50', label: 'E. coli 50µM', unit: 'OD',
            scale: 'activity', reverse: true, log: false,
            getValue: c => getPropAvg(c.props.ec_50),
          },
          {
            key: 'ec_100', label: 'E. coli 100µM', unit: 'OD',
            scale: 'activity', reverse: true, log: false,
            getValue: c => getPropAvg(c.props.ec_100),
          },
          {
            key: 'hek_50', label: 'HEK293T', unit: '%',
            scale: 'tox', reverse: false, log: false,
            getValue: c => getPropAvg(c.props.hek_50),
          },
        ],
        scatterAxes: [
          { key: 'sa_50',      label: 'S. aureus 50µM (OD)',   getValue: c => getPropAvg(c.props.sa_50),      log: false },
          { key: 'sa_12',      label: 'S. aureus 12.5µM (OD)', getValue: c => getPropAvg(c.props.sa_12),      log: false },
          { key: 'ec_50',      label: 'E. coli 50µM (OD)',     getValue: c => getPropAvg(c.props.ec_50),      log: false },
          { key: 'ec_100',     label: 'E. coli 100µM (OD)',    getValue: c => getPropAvg(c.props.ec_100),     log: false },
          { key: 'hek_50',     label: 'HEK293T (%)',           getValue: c => getPropAvg(c.props.hek_50),     log: false },
          { key: 'hek_sd',     label: 'HEK293T SD',            getValue: c => getPropAvg(c.props.hek_sd),     log: false },
          { key: 'conversion', label: 'Conversion (%)',        getValue: c => getPropAvg(c.props.conversion), log: false },
          { key: 'rt_target',  label: 'RT Target (min)',       getValue: c => getPropAvg(c.props.rt_target),  log: false },
          ...LIGAND_DESCRIPTOR_AXES,
        ],
        umapAxes: UMAP_AXES,
        scatterDefaultX: 'sa_50',
        scatterDefaultY: 'hek_50',
      },
    ],
  },
}

// ── Public API ────────────────────────────────────────────────────────────────

export function adaptLibrary(library) {
  const cfg = LIBRARY_CONFIGS[library.id]
  if (!cfg) return null

  // Build BB lookup: positionKey → code → bb object
  const bbByPosition = {}
  for (const [posKey, bbs] of Object.entries(library.building_blocks)) {
    bbByPosition[posKey] = {}
    for (const bb of bbs) bbByPosition[posKey][bb.code] = bb
  }

  return {
    facetType: cfg.facetType,
    grids: cfg.grids.map(gridCfg => {
      const compounds = library.compounds
        .filter(gridCfg.compoundFilter)
        .map(c => ({ ...c, _row: c.blocks[gridCfg.rowPosition], _col: c.blocks[gridCfg.colPosition], _facet: c.blocks[gridCfg.facetPosition] }))

      let rowCodes = [...new Set(compounds.map(c => c._row))].filter(Boolean).sort(naturalSort)
      let colCodes = [...new Set(compounds.map(c => c._col))].filter(Boolean).sort(naturalSort)
      let facetCodes = [...new Set(compounds.map(c => c._facet))].filter(Boolean).sort(naturalSort)

      if (gridCfg.rowFilter)   rowCodes   = rowCodes.filter(gridCfg.rowFilter)
      if (gridCfg.colFilter)   colCodes   = colCodes.filter(gridCfg.colFilter)
      if (gridCfg.facetFilter) facetCodes = facetCodes.filter(gridCfg.facetFilter)

      return {
        ...gridCfg,
        compounds,
        rowCodes,
        colCodes,
        facetCodes,
        bbByPosition,
        positions: library.positions,
        allMetrics: gridCfg.metrics,
      }
    }),
  }
}

export function computeRange(compounds, metric) {
  let min = Infinity, max = -Infinity
  for (const c of compounds) {
    const v = metric.getValue(c)
    if (v !== null && v !== undefined && isFinite(v)) {
      if (v < min) min = v
      if (v > max) max = v
    }
  }
  return min === Infinity ? { min: 0, max: 1 } : { min, max }
}

export function computeAggregates(compounds, rowCodes, colCodes, metric, dimension) {
  const agg = {}
  const codes = dimension === 'row' ? rowCodes : colCodes
  const key   = dimension === 'row' ? '_row' : '_col'
  for (const code of codes) {
    const vals = compounds.filter(c => c[key] === code).map(c => metric.getValue(c)).filter(v => v !== null && isFinite(v))
    agg[code] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }
  return agg
}
