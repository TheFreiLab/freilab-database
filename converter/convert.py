#!/usr/bin/env python3
"""
Frei Lab Compound Database — Excel → JSON converter.

Usage:
    python convert.py <excel_file> <output_dir> --library-id <ID>

Supported library IDs:
    IrCpSB    — Ir Cp Schiff-Base combinatorial library (single sheet)
    TzLib     — Metal-Triazole combinatorial library (multi-sheet)

Writes:
    <output_dir>/manifest.json
    <output_dir>/libraries/<ID>.json
"""

import sys
import json
import re
import argparse
from pathlib import Path

import openpyxl
from rdkit import Chem
from rdkit.Chem.Draw import rdMolDraw2D
from rdkit.Chem.inchi import MolToInchiKey

# ═══════════════════════════════════════════════════════════════════════════════
# Shared metadata — add a new entry here for each new library
# ═══════════════════════════════════════════════════════════════════════════════

LIBRARY_META = {
    "IrCpSB": {
        "title": "Ir Cp Schiff-Base Library",
        "description": (
            "1,440 iridium Cp Schiff-base compounds from a combinatorial library "
            "screened for antibacterial activity against S. aureus and E. coli, "
            "and for cytotoxicity against HEK293T cells."
        ),
        "metal": "Ir",
        "scaffold": "Cp Schiff-Base",
        "doi": None,  # fill in before publishing
    },
    "TzLib": {
        "title": "Metal-Triazole Combinatorial Library",
        "description": (
            "864 metal-triazole compounds from two combinatorial series "
            "(Tz-4-P and Tz-1-MP) across multiple metal scaffolds "
            "(IrCN, Re(CO)₃, Mn(CO)₃, RuCy), screened for "
            "antibacterial activity against S. aureus and cytotoxicity "
            "against HEK293T cells."
        ),
        "metal": "Ir / Re / Mn / Ru",
        "scaffold": "Triazole",
        "doi": "10.1038/s41467-025-67341-z",
    },
}

# ═══════════════════════════════════════════════════════════════════════════════
# Shared helpers
# ═══════════════════════════════════════════════════════════════════════════════

def clean_val(v):
    """Float or None — treats '-', 'N.A.', empty string as missing."""
    if v is None or (isinstance(v, str) and v.strip() in ("-", "", "N.A.", "N/A", "NA")):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def smiles_to_svg(smiles, width=220, height=180):
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    drawer = rdMolDraw2D.MolDraw2DSVG(width, height)
    drawer.drawOptions().addStereoAnnotation = True
    drawer.DrawMolecule(mol)
    drawer.FinishDrawing()
    return drawer.GetDrawingText()


def smiles_to_inchikey(smiles):
    mol = Chem.MolFromSmiles(smiles)
    return MolToInchiKey(mol) if mol else None


def render_building_blocks(bb_map):
    """
    bb_map: {position_key: {smiles_or_None: code}}
    Returns building_blocks dict ready for the JSON output.
    Positions whose SMILES are None get null svg/canonical_key.
    """
    building_blocks = {}
    for pos_key, entries in bb_map.items():
        building_blocks[pos_key] = []
        for smiles, code in sorted(entries.items(), key=lambda x: x[1]):
            if smiles:
                print(f"  {pos_key} {code} ...", end=" ", flush=True)
                svg = smiles_to_svg(smiles)
                ik  = smiles_to_inchikey(smiles)
                print("ok")
            else:
                svg, ik = None, None
            building_blocks[pos_key].append({
                "code": code,
                "smiles": smiles,
                "name": None,
                "canonical_key": ik,
                "svg": svg,
            })
    return building_blocks


def write_outputs(library, output_dir):
    """Write the library JSON and update manifest.json."""
    out     = Path(output_dir)
    lib_dir = out / "libraries"
    lib_dir.mkdir(parents=True, exist_ok=True)

    lib_path = lib_dir / f"{library['id']}.json"
    with open(lib_path, "w", encoding="utf-8") as f:
        json.dump(library, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {lib_path}  ({lib_path.stat().st_size // 1024} KB)")

    manifest_path = out / "manifest.json"
    if manifest_path.exists():
        with open(manifest_path, encoding="utf-8") as f:
            manifest = json.load(f)
    else:
        manifest = {"libraries": []}

    meta      = LIBRARY_META[library["id"]]
    lib_id    = library["id"]
    entry = {
        "id":             lib_id,
        "title":          meta["title"],
        "description":    meta["description"],
        "metal":          meta["metal"],
        "scaffold":       meta["scaffold"],
        "doi":            meta["doi"],
        "compound_count": len(library["compounds"]),
        "position_count": len(library["positions"]),
    }
    existing = {lib["id"] for lib in manifest["libraries"]}
    if lib_id in existing:
        manifest["libraries"] = [
            entry if lib["id"] == lib_id else lib
            for lib in manifest["libraries"]
        ]
    else:
        manifest["libraries"].append(entry)

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"Wrote {manifest_path}")


# ═══════════════════════════════════════════════════════════════════════════════
# IrCpSB — Ir Cp Schiff-Base (single sheet, 3 SMILES columns, 4-rep assays)
# ═══════════════════════════════════════════════════════════════════════════════

IRCPSB_POSITIONS = [
    {"key": "Cp",    "label": "Cp Ligand", "col": 1},
    {"key": "Ald",   "label": "Aldehyde",  "col": 2},
    {"key": "Amine", "label": "Amine",     "col": 3},
]

IRCPSB_PROPERTIES = [
    {"key": "conversion", "label": "Conversion",         "unit": "%",   "role": "qc",      "group": None,            "col": 4,  "rep_cols": None},
    {"key": "rt_target",  "label": "RT (Target)",         "unit": "min", "role": "qc",      "group": None,            "col": 5,  "rep_cols": None},
    {"key": "rt_2plus",   "label": "RT (2+)",             "unit": "min", "role": "qc",      "group": None,            "col": 6,  "rep_cols": None},
    {"key": "sa_50",      "label": "S. aureus 50 µM",  "unit": "OD",  "role": "primary", "group": "Antibacterial", "col": 11, "rep_cols": [7, 8, 9, 10]},
    {"key": "sa_12",      "label": "S. aureus 12.5 µM","unit": "OD",  "role": "primary", "group": "Antibacterial", "col": 16, "rep_cols": [12, 13, 14, 15]},
    {"key": "ec_50",      "label": "E. coli 50 µM",   "unit": "OD",  "role": "primary", "group": "Antibacterial", "col": 21, "rep_cols": [17, 18, 19, 20]},
    {"key": "hek_50",     "label": "HEK293T 50 µM",   "unit": "%",   "role": "primary", "group": "Cytotoxicity",  "col": 26, "rep_cols": [22, 23, 24, 25]},
    {"key": "ratio",      "label": "Selectivity Ratio",   "unit": None,  "role": "derived", "group": None,            "col": 27, "rep_cols": None},
]


def _parse_ircpsb_id(cid):
    m = re.match(r"IrCp(\d+)([A-Z]+)(\d+)$", str(cid))
    if not m:
        return None
    return {"Cp": f"Cp{m.group(1)}", "Ald": m.group(2), "Amine": m.group(3)}


def convert_ircpsb(wb, library_id):
    ws        = wb.active
    data_rows = [r for r in ws.iter_rows(values_only=True) if r[0] and r[0] != "Compounds"]
    print(f"  {len(data_rows)} compound rows")

    # Collect unique SMILES per position
    bb_map = {p["key"]: {} for p in IRCPSB_POSITIONS}
    skipped = 0
    for row in data_rows:
        blocks = _parse_ircpsb_id(row[0])
        if not blocks:
            print(f"  Warning: cannot parse '{row[0]}' — skipping")
            skipped += 1
            continue
        for pos in IRCPSB_POSITIONS:
            smiles = row[pos["col"]]
            if smiles and smiles not in bb_map[pos["key"]]:
                bb_map[pos["key"]][smiles] = blocks[pos["key"]]
    if skipped:
        print(f"  {skipped} rows skipped")
    for pos in IRCPSB_POSITIONS:
        print(f"  {pos['key']}: {len(bb_map[pos['key']])} unique")

    print("Generating SVGs ...")
    building_blocks = render_building_blocks(bb_map)

    print("Building compound records ...")
    compounds = []
    for row in data_rows:
        blocks = _parse_ircpsb_id(row[0])
        if not blocks:
            continue
        props = {}
        for p in IRCPSB_PROPERTIES:
            avg = clean_val(row[p["col"]])
            if p["rep_cols"]:
                props[p["key"]] = {"avg": avg, "reps": [clean_val(row[i]) for i in p["rep_cols"]]}
            else:
                props[p["key"]] = avg
        compounds.append({"id": row[0], "blocks": blocks, "props": props})

    meta = LIBRARY_META[library_id]
    return {
        "id": library_id, "title": meta["title"], "description": meta["description"],
        "metal": meta["metal"], "scaffold": meta["scaffold"], "doi": meta["doi"],
        "positions":       [{"key": p["key"], "label": p["label"]} for p in IRCPSB_POSITIONS],
        "properties":      [{k: v for k, v in p.items() if k not in ("col", "rep_cols")} for p in IRCPSB_PROPERTIES],
        "building_blocks": building_blocks,
        "compounds":       compounds,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# TzLib — Metal-Triazole library (multi-sheet, concatenated SMILES, no reps)
# ═══════════════════════════════════════════════════════════════════════════════

TZ_POSITIONS = [
    {"key": "Scaffold", "label": "Metal Scaffold"},
    {"key": "Amine",    "label": "Amine"},
    {"key": "Alkyne",   "label": "Alkyne"},
]

TZ_PROPERTIES = [
    {"key": "peak_pct",  "label": "Peak %",             "unit": "%",   "role": "qc",       "group": None},
    {"key": "peak_norm", "label": "Peak % (norm.)",     "unit": "%",   "role": "qc",       "group": None},
    {"key": "rt",        "label": "RT",                 "unit": "min", "role": "qc",       "group": None},
    {"key": "sdr",       "label": "SDR (S. aureus)",    "unit": "µM",  "role": "primary",  "group": "Antibacterial"},
    {"key": "mic",       "label": "MIC (S. aureus)",    "unit": "µM",  "role": "primary",  "group": "Antibacterial"},
    {"key": "tox_avg",   "label": "HEK293T growth",     "unit": "%",   "role": "primary",  "group": "Cytotoxicity"},
    {"key": "tox_sd",    "label": "HEK293T SD",         "unit": "%",   "role": "replicate","group": "Cytotoxicity"},
]

# Each entry describes one sheet: how to identify it, parse its compound IDs,
# and which columns hold each property.
TZ_SHEET_CONFIGS = [
    # ── Tz-4-P series (24 amines M1–M24 × 4 alkynes Y1–Y4) ──────────────────
    {
        "sheet": "Tz-4-P",
        "scaffold_code":  "Free_Tz4P",
        "scaffold_label": "Free triazole (Tz-4-P)",
        "amine_prefix": "M", "alkyne_prefix": "Y",
        "id_re": re.compile(r"^M(\d+)Y(\d+)$"),
        "cols": {"peak_pct": 2, "peak_norm": None, "rt": 3, "sdr": 4, "mic": 5, "tox_avg": 6, "tox_sd": 7},
    },
    {
        "sheet": "IrCN",
        "scaffold_code":  "IrCN",
        "scaffold_label": "IrCN",
        "amine_prefix": "M", "alkyne_prefix": "Y",
        "id_re": re.compile(r"^IrCN_M(\d+)Y(\d+)$"),
        "cols": {"peak_pct": 2, "peak_norm": None, "rt": 3, "sdr": 4, "mic": 5, "tox_avg": 6, "tox_sd": 7},
    },
    {
        "sheet": "Re(CO)3",
        "scaffold_code":  "Re_CO3",
        "scaffold_label": "Re(CO)₃",
        "amine_prefix": "M", "alkyne_prefix": "Y",
        "id_re": re.compile(r"^Re\(CO\)3M(\d+)Y(\d+)$"),
        "cols": {"peak_pct": 2, "peak_norm": None, "rt": 3, "sdr": 4, "mic": 5, "tox_avg": 6, "tox_sd": 7},
    },
    {
        "sheet": "Re(CO)3 solvent",
        "scaffold_code":  "Re_CO3_solv",
        "scaffold_label": "Re(CO)₃ (solvento)",
        "amine_prefix": "M", "alkyne_prefix": "Y",
        "id_re": re.compile(r"^Re\(CO\)3M(\d+)Y(\d+)solvent$"),
        "cols": {"peak_pct": 2, "peak_norm": None, "rt": 3, "sdr": 4, "mic": None, "tox_avg": None, "tox_sd": None},
    },
    {
        "sheet": "Mn(CO)3",
        "scaffold_code":  "Mn_CO3",
        "scaffold_label": "Mn(CO)₃",
        "amine_prefix": "M", "alkyne_prefix": "Y",
        "id_re": re.compile(r"^Mn\(CO\)3M(\d+)Y(\d+)$"),
        "cols": {"peak_pct": 2, "peak_norm": None, "rt": 3, "sdr": 4, "mic": 5, "tox_avg": 6, "tox_sd": 7},
    },
    {
        "sheet": "Mn(CO)3 solvent",
        "scaffold_code":  "Mn_CO3_solv",
        "scaffold_label": "Mn(CO)₃ (solvento)",
        "amine_prefix": "M", "alkyne_prefix": "Y",
        "id_re": re.compile(r"^Mn\(CO\)3M(\d+)Y(\d+)solvent$"),
        "cols": {"peak_pct": 2, "peak_norm": None, "rt": 3, "sdr": 4, "mic": None, "tox_avg": None, "tox_sd": None},
    },
    {
        "sheet": "RuCy(Tz-4-P)",
        "scaffold_code":  "RuCy_Tz4P",
        "scaffold_label": "RuCy (Tz-4-P)",
        "amine_prefix": "M", "alkyne_prefix": "Y",
        "id_re": re.compile(r"^RuCyM(\d+)Y(\d+)$"),
        "cols": {"peak_pct": 2, "peak_norm": 3, "rt": 4, "sdr": 5, "mic": 6, "tox_avg": None, "tox_sd": None},
    },
    # ── Tz-1-MP series (8 amines P1–P8 × 12 alkynes A1–A12) ─────────────────
    {
        "sheet": "Tz-1-MP",
        "scaffold_code":  "Free_Tz1MP",
        "scaffold_label": "Free triazole (Tz-1-MP)",
        "amine_prefix": "P", "alkyne_prefix": "A",
        "id_re": re.compile(r"^P(\d+)A(\d+)$"),
        "cols": {"peak_pct": 2, "peak_norm": None, "rt": 3, "sdr": 4, "mic": None, "tox_avg": 5, "tox_sd": 6},
    },
    {
        "sheet": "RuCy(Tz-1-MP) ",  # trailing space in workbook
        "scaffold_code":  "RuCy_Tz1MP",
        "scaffold_label": "RuCy (Tz-1-MP)",
        "amine_prefix": "P", "alkyne_prefix": "A",
        "id_re": re.compile(r"^RuCyP(\d+)A(\d+)$"),
        "cols": {"peak_pct": 2, "peak_norm": 3, "rt": 4, "sdr": 5, "mic": None, "tox_avg": 6, "tox_sd": 7},
    },
]


def convert_tzlib(wb, library_id):
    # bb_map: position_key → {smiles_or_None: code}
    bb_map = {"Scaffold": {}, "Amine": {}, "Alkyne": {}}
    all_compounds = []

    for cfg in TZ_SHEET_CONFIGS:
        sheet_name = cfg["sheet"]
        # Handle workbook sheets that may have trailing spaces
        ws = None
        for name in wb.sheetnames:
            if name.strip() == sheet_name.strip():
                ws = wb[name]
                break
        if ws is None:
            print(f"  Warning: sheet '{sheet_name}' not found — skipping")
            continue

        data_rows = [r for r in ws.iter_rows(values_only=True) if r[0] and r[0] != "Compound"]
        print(f"  Sheet '{sheet_name.strip()}': {len(data_rows)} rows")

        # Register this scaffold (no SMILES — to be added for Stage 3)
        sc = cfg["scaffold_code"]
        if sc not in bb_map["Scaffold"]:
            bb_map["Scaffold"][None if sc == sc else sc] = sc  # placeholder key trick below
        # Use scaffold_code as key directly (no SMILES for scaffold)
        bb_map["Scaffold"][cfg["scaffold_code"]] = cfg["scaffold_code"]

        ap = cfg["amine_prefix"]
        kp = cfg["alkyne_prefix"]
        cols = cfg["cols"]

        for row in data_rows:
            cid = str(row[0])
            m   = cfg["id_re"].match(cid)
            if not m:
                print(f"    Warning: cannot parse '{cid}' with pattern {cfg['id_re'].pattern}")
                continue

            amine_code  = f"{ap}{m.group(1)}"
            alkyne_code = f"{kp}{m.group(2)}"

            # Split concatenated SMILES
            smiles_raw = str(row[1]) if row[1] else ""
            parts      = smiles_raw.split(".")
            amine_smi  = parts[0] if len(parts) >= 1 else None
            alkyne_smi = parts[1] if len(parts) >= 2 else None

            if amine_smi  and amine_code  not in bb_map["Amine"]:
                bb_map["Amine"][amine_smi]   = amine_code
            if alkyne_smi and alkyne_code not in bb_map["Alkyne"]:
                bb_map["Alkyne"][alkyne_smi] = alkyne_code

            # Properties
            def gc(col_key):
                ci = cols.get(col_key)
                return clean_val(row[ci]) if ci is not None else None

            props = {
                "peak_pct":  gc("peak_pct"),
                "peak_norm": gc("peak_norm"),
                "rt":        gc("rt"),
                "sdr":       gc("sdr"),
                "mic":       gc("mic"),
                "tox_avg":   gc("tox_avg"),
                "tox_sd":    gc("tox_sd"),
            }
            all_compounds.append({
                "id": cid,
                "blocks": {
                    "Scaffold": cfg["scaffold_code"],
                    "Amine":    amine_code,
                    "Alkyne":   alkyne_code,
                },
                "props": props,
            })

    # Scaffold building blocks have no SMILES (stored as code→code map)
    # Rebuild bb_map["Scaffold"] so render_building_blocks gets None as SMILES key
    scaffold_entries = {}
    seen_scaffolds = set()
    for cfg in TZ_SHEET_CONFIGS:
        sc = cfg["scaffold_code"]
        if sc not in seen_scaffolds:
            scaffold_entries[sc] = cfg["scaffold_label"]
            seen_scaffolds.add(sc)

    # Produce building_blocks manually for Scaffold (no SMILES/SVG yet)
    scaffold_bbs = [
        {"code": code, "smiles": None, "name": label, "canonical_key": None, "svg": None}
        for code, label in scaffold_entries.items()
    ]

    # Render Amine and Alkyne SVGs
    print("Generating SVGs for Amine and Alkyne building blocks ...")
    amine_alkyne_map  = {"Amine": bb_map["Amine"], "Alkyne": bb_map["Alkyne"]}
    rendered          = render_building_blocks(amine_alkyne_map)

    building_blocks = {
        "Scaffold": scaffold_bbs,
        "Amine":    rendered["Amine"],
        "Alkyne":   rendered["Alkyne"],
    }

    print(f"  Scaffold: {len(scaffold_bbs)} | Amine: {len(rendered['Amine'])} | Alkyne: {len(rendered['Alkyne'])}")
    print(f"  Total compounds: {len(all_compounds)}")

    meta = LIBRARY_META[library_id]
    return {
        "id": library_id, "title": meta["title"], "description": meta["description"],
        "metal": meta["metal"], "scaffold": meta["scaffold"], "doi": meta["doi"],
        "positions":       [{"key": p["key"], "label": p["label"]} for p in TZ_POSITIONS],
        "properties":      TZ_PROPERTIES,
        "building_blocks": building_blocks,
        "compounds":       all_compounds,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Entry point
# ═══════════════════════════════════════════════════════════════════════════════

CONVERTERS = {
    "IrCpSB": convert_ircpsb,
    "TzLib":  convert_tzlib,
}


def convert(excel_path, output_dir, library_id):
    if library_id not in LIBRARY_META:
        sys.exit(f"Unknown library ID '{library_id}'. Valid IDs: {list(LIBRARY_META)}")

    print(f"Reading {excel_path} ...")
    wb      = openpyxl.load_workbook(excel_path, read_only=True, data_only=True)
    library = CONVERTERS[library_id](wb, library_id)
    write_outputs(library, output_dir)
    print("Done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert Frei Lab Excel → JSON")
    parser.add_argument("excel",  help="Path to the source Excel file")
    parser.add_argument("output", help="Output directory (e.g. ../public/data)")
    parser.add_argument("--library-id", required=True, help=f"One of: {list(LIBRARY_META)}")
    args = parser.parse_args()
    convert(args.excel, args.output, args.library_id)
