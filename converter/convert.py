#!/usr/bin/env python3
"""
Frei Lab Compound Database — Excel → JSON converter.

Usage:
    python convert.py <excel_file> <output_dir> [--library-id ID]

Reads a structured Excel file and writes:
    <output_dir>/manifest.json          (appended/created)
    <output_dir>/libraries/<ID>.json    (full library data)
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

# ── Library metadata (add a new entry here when adding a new library) ────────

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
}

# ── Column layout for this Excel format ──────────────────────────────────────
# All indices are 0-based.

POSITIONS = [
    {"key": "Cp",    "label": "Cp Ligand", "col": 1},
    {"key": "Ald",   "label": "Aldehyde",  "col": 2},
    {"key": "Amine", "label": "Amine",     "col": 3},
]

PROPERTIES = [
    {"key": "conversion", "label": "Conversion",        "unit": "%",   "role": "qc",      "group": None,             "col": 4,  "rep_cols": None},
    {"key": "rt_target",  "label": "RT (Target)",        "unit": "min", "role": "qc",      "group": None,             "col": 5,  "rep_cols": None},
    {"key": "rt_2plus",   "label": "RT (2+)",            "unit": "min", "role": "qc",      "group": None,             "col": 6,  "rep_cols": None},
    {"key": "sa_50",      "label": "S. aureus 50 µM",  "unit": "OD",  "role": "primary", "group": "Antibacterial",  "col": 11, "rep_cols": [7, 8, 9, 10]},
    {"key": "sa_12",      "label": "S. aureus 12.5 µM","unit": "OD",  "role": "primary", "group": "Antibacterial",  "col": 16, "rep_cols": [12, 13, 14, 15]},
    {"key": "ec_50",      "label": "E. coli 50 µM",   "unit": "OD",  "role": "primary", "group": "Antibacterial",  "col": 21, "rep_cols": [17, 18, 19, 20]},
    {"key": "hek_50",     "label": "HEK293T 50 µM",   "unit": "%",   "role": "primary", "group": "Cytotoxicity",   "col": 26, "rep_cols": [22, 23, 24, 25]},
    {"key": "ratio",      "label": "Selectivity Ratio",  "unit": None,  "role": "derived", "group": None,             "col": 27, "rep_cols": None},
]

# ── Helpers ──────────────────────────────────────────────────────────────────

def clean_val(v):
    """Float or None; '-' and non-numeric become None."""
    if v is None or v == "-" or v == "":
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


def parse_compound_id(cid):
    """
    'IrCp4A11' → {'Cp': 'Cp4', 'Ald': 'A', 'Amine': '11'}
    Returns None if the ID doesn't match the expected pattern.
    """
    m = re.match(r"IrCp(\d+)([A-Z]+)(\d+)$", str(cid))
    if not m:
        return None
    return {"Cp": f"Cp{m.group(1)}", "Ald": m.group(2), "Amine": m.group(3)}

# ── Main conversion ──────────────────────────────────────────────────────────

def convert(excel_path, output_dir, library_id="IrCpSB"):
    if library_id not in LIBRARY_META:
        sys.exit(f"Unknown library ID '{library_id}'. Add it to LIBRARY_META in convert.py.")

    print(f"Reading {excel_path} ...")
    wb = openpyxl.load_workbook(excel_path, read_only=True, data_only=True)
    ws = wb.active
    data_rows = [
        r for r in ws.iter_rows(values_only=True)
        if r[0] and r[0] != "Compounds"
    ]
    print(f"  {len(data_rows)} compound rows")

    # ── 1. Collect unique building blocks per position ────────────────────────
    # Maps: position_key → {smiles: code}
    bb_map = {p["key"]: {} for p in POSITIONS}

    skipped = 0
    for row in data_rows:
        blocks = parse_compound_id(row[0])
        if not blocks:
            print(f"  Warning: cannot parse compound ID '{row[0]}' — skipping")
            skipped += 1
            continue
        for pos in POSITIONS:
            smiles = row[pos["col"]]
            if smiles and smiles not in bb_map[pos["key"]]:
                bb_map[pos["key"]][smiles] = blocks[pos["key"]]

    if skipped:
        print(f"  {skipped} rows skipped due to unparseable IDs")

    for pos in POSITIONS:
        print(f"  {pos['key']}: {len(bb_map[pos['key']])} unique building blocks")

    # ── 2. Render 2D SVGs and compute InChIKeys ───────────────────────────────
    print("Generating 2D structure SVGs ...")
    building_blocks = {}
    for pos in POSITIONS:
        key = pos["key"]
        building_blocks[key] = []
        # Sort by code so output order is deterministic
        for smiles, code in sorted(bb_map[key].items(), key=lambda x: x[1]):
            print(f"  {key} {code} ...", end=" ", flush=True)
            svg = smiles_to_svg(smiles)
            ik = smiles_to_inchikey(smiles)
            print("ok")
            building_blocks[key].append({
                "code": code,
                "smiles": smiles,
                "name": None,
                "canonical_key": ik,
                "svg": svg,
            })

    # ── 3. Build compound records ─────────────────────────────────────────────
    print("Building compound records ...")
    compounds = []
    prop_defs = {p["key"]: p for p in PROPERTIES}

    for row in data_rows:
        blocks = parse_compound_id(row[0])
        if not blocks:
            continue

        props = {}
        for p in PROPERTIES:
            avg = clean_val(row[p["col"]])
            if p["rep_cols"]:
                reps = [clean_val(row[i]) for i in p["rep_cols"]]
                props[p["key"]] = {"avg": avg, "reps": reps}
            else:
                props[p["key"]] = avg

        compounds.append({
            "id": row[0],
            "blocks": blocks,
            "props": props,
        })

    # ── 4. Assemble and write library JSON ────────────────────────────────────
    meta = LIBRARY_META[library_id]
    library = {
        "id": library_id,
        "title": meta["title"],
        "description": meta["description"],
        "metal": meta["metal"],
        "scaffold": meta["scaffold"],
        "doi": meta["doi"],
        "positions": [{"key": p["key"], "label": p["label"]} for p in POSITIONS],
        "properties": [
            {k: v for k, v in p.items() if k not in ("col", "rep_cols")}
            for p in PROPERTIES
        ],
        "building_blocks": building_blocks,
        "compounds": compounds,
    }

    out = Path(output_dir)
    lib_dir = out / "libraries"
    lib_dir.mkdir(parents=True, exist_ok=True)

    lib_path = lib_dir / f"{library_id}.json"
    with open(lib_path, "w", encoding="utf-8") as f:
        json.dump(library, f, ensure_ascii=False, separators=(",", ":"))
    size_kb = lib_path.stat().st_size // 1024
    print(f"Wrote {lib_path}  ({size_kb} KB)")

    # ── 5. Update manifest.json ───────────────────────────────────────────────
    manifest_path = out / "manifest.json"
    if manifest_path.exists():
        with open(manifest_path, encoding="utf-8") as f:
            manifest = json.load(f)
    else:
        manifest = {"libraries": []}

    existing_ids = {lib["id"] for lib in manifest["libraries"]}
    entry = {
        "id": library_id,
        "title": meta["title"],
        "description": meta["description"],
        "metal": meta["metal"],
        "scaffold": meta["scaffold"],
        "doi": meta["doi"],
        "compound_count": len(compounds),
        "position_count": len(POSITIONS),
    }
    if library_id in existing_ids:
        manifest["libraries"] = [
            entry if lib["id"] == library_id else lib
            for lib in manifest["libraries"]
        ]
    else:
        manifest["libraries"].append(entry)

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"Wrote {manifest_path}")
    print("Done.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert Frei Lab Excel → JSON")
    parser.add_argument("excel",   help="Path to the source Excel file")
    parser.add_argument("output",  help="Output directory (e.g. ../public/data)")
    parser.add_argument("--library-id", default="IrCpSB", help="Library identifier key")
    args = parser.parse_args()
    convert(args.excel, args.output, args.library_id)
