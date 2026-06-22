// Maps a library JSON object → array of GridConfig objects ready for LibraryGrid.
// All library-specific knowledge lives here; components stay generic.

function getPropAvg(v) {
  if (v === null || v === undefined) return null
  return typeof v === 'object' ? (v.avg ?? null) : v
}

function naturalSort(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

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
        scatterModes: [
          {
            label: 'Activity vs Tox',
            xAxis: { key: 'sa_50',  label: 'S. aureus 50µM (OD)', getValue: c => getPropAvg(c.props.sa_50),  log: false },
            yAxis: { key: 'hek_50', label: 'HEK293T (%)',          getValue: c => getPropAvg(c.props.hek_50), log: false },
          },
          {
            label: 'Selectivity vs Conversion',
            xAxis: { key: 'ratio',      label: 'Selectivity Ratio', getValue: c => getPropAvg(c.props.ratio)      },
            yAxis: { key: 'conversion', label: 'Conversion (%)',     getValue: c => getPropAvg(c.props.conversion) },
          },
          {
            label: 'S. aureus vs RT (Target)',
            xAxis: { key: 'rt_target', label: 'RT Target (min)',      getValue: c => getPropAvg(c.props.rt_target) },
            yAxis: { key: 'sa_50',     label: 'S. aureus 50µM (OD)', getValue: c => getPropAvg(c.props.sa_50)     },
          },
          {
            label: 'Conversion vs RT (Target)',
            xAxis: { key: 'rt_target', label: 'RT Target (min)', getValue: c => getPropAvg(c.props.rt_target)  },
            yAxis: { key: 'conversion', label: 'Conversion (%)', getValue: c => getPropAvg(c.props.conversion) },
          },
          {
            label: 'S. aureus vs RT (2+)',
            xAxis: { key: 'rt_2plus', label: 'RT 2+ (min)',          getValue: c => getPropAvg(c.props.rt_2plus) },
            yAxis: { key: 'sa_50',    label: 'S. aureus 50µM (OD)', getValue: c => getPropAvg(c.props.sa_50)    },
          },
          {
            label: 'Conversion vs RT (2+)',
            xAxis: { key: 'rt_2plus',   label: 'RT 2+ (min)',    getValue: c => getPropAvg(c.props.rt_2plus)   },
            yAxis: { key: 'conversion', label: 'Conversion (%)', getValue: c => getPropAvg(c.props.conversion) },
          },
        ],
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
        scatterModes: [
          {
            label: 'MIC vs HEK293T',
            xAxis: { key: 'mic',     label: 'MIC S. aureus (µM)', getValue: c => getPropAvg(c.props.mic),     log: true  },
            yAxis: { key: 'tox_avg', label: 'HEK293T growth (%)', getValue: c => getPropAvg(c.props.tox_avg), log: false },
          },
          {
            label: 'Selectivity vs Conversion',
            xAxis: { key: 'sdr',      label: 'Selectivity (SDR)', getValue: c => getPropAvg(c.props.sdr)      },
            yAxis: { key: 'peak_pct', label: 'Conversion (%)',    getValue: c => getPropAvg(c.props.peak_pct) },
          },
          {
            label: 'MIC vs RT',
            xAxis: { key: 'rt',  label: 'RT (min)',            getValue: c => getPropAvg(c.props.rt)            },
            yAxis: { key: 'mic', label: 'MIC S. aureus (µM)', getValue: c => getPropAvg(c.props.mic), log: true },
          },
          {
            label: 'Conversion vs RT',
            xAxis: { key: 'rt',       label: 'RT (min)',       getValue: c => getPropAvg(c.props.rt)       },
            yAxis: { key: 'peak_pct', label: 'Conversion (%)', getValue: c => getPropAvg(c.props.peak_pct) },
          },
        ],
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
        scatterModes: [
          {
            label: 'MIC vs HEK293T',
            xAxis: { key: 'mic',     label: 'MIC S. aureus (µM)', getValue: c => getPropAvg(c.props.mic),     log: true  },
            yAxis: { key: 'tox_avg', label: 'HEK293T growth (%)', getValue: c => getPropAvg(c.props.tox_avg), log: false },
          },
          {
            label: 'Selectivity vs Conversion',
            xAxis: { key: 'sdr',      label: 'Selectivity (SDR)', getValue: c => getPropAvg(c.props.sdr)      },
            yAxis: { key: 'peak_pct', label: 'Conversion (%)',    getValue: c => getPropAvg(c.props.peak_pct) },
          },
          {
            label: 'MIC vs RT',
            xAxis: { key: 'rt',  label: 'RT (min)',            getValue: c => getPropAvg(c.props.rt)            },
            yAxis: { key: 'mic', label: 'MIC S. aureus (µM)', getValue: c => getPropAvg(c.props.mic), log: true },
          },
          {
            label: 'Conversion vs RT',
            xAxis: { key: 'rt',       label: 'RT (min)',       getValue: c => getPropAvg(c.props.rt)       },
            yAxis: { key: 'peak_pct', label: 'Conversion (%)', getValue: c => getPropAvg(c.props.peak_pct) },
          },
        ],
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

      // Extract sorted unique codes
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
