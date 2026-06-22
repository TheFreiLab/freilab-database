#!/usr/bin/env python3
"""
Frei Lab Compound Database — ligand descriptor computation (Stage 7a).

Post-processes the library JSONs produced by convert.py. Because the compounds
have no whole-molecule SMILES and the metal scaffolds have no SMILES at all,
descriptors are computed on the *organic building blocks* (which do carry SMILES)
and aggregated per compound.

For each building block with a SMILES:
    descriptors = {mw, tpsa, logp, hbd, hba, rotb, arring}
stored on the building-block object under "descriptors".

For each compound, the per-ligand values are aggregated:
    additive (mw, tpsa, hbd, hba, rotb, arring) -> sum over organic ligands
    logp                                         -> mean over organic ligands
stored in compound.props under the lig_* keys, and registered in the library's
"properties" list with role "descriptor".

Run AFTER convert.py (operates in place on the JSON files):
    python compute_descriptors.py ../public/data
    python compute_descriptors.py ../public/data --library-id TzLib
"""

import sys
import json
import argparse
from pathlib import Path

from rdkit import Chem
from rdkit.Chem import Descriptors, Crippen, rdMolDescriptors

# ── Descriptor definitions ────────────────────────────────────────────────────
# key -> (label, unit, callable, aggregation)
DESCRIPTORS = {
    "mw":     ("Molecular weight", "Da",  lambda m: Descriptors.MolWt(m),                 "sum"),
    "tpsa":   ("TPSA",             "Å²",  lambda m: rdMolDescriptors.CalcTPSA(m),         "sum"),
    "logp":   ("logP (Crippen)",   None,  lambda m: Crippen.MolLogP(m),                   "mean"),
    "hbd":    ("H-bond donors",    None,  lambda m: rdMolDescriptors.CalcNumHBD(m),       "sum"),
    "hba":    ("H-bond acceptors", None,  lambda m: rdMolDescriptors.CalcNumHBA(m),       "sum"),
    "rotb":   ("Rotatable bonds",  None,  lambda m: rdMolDescriptors.CalcNumRotatableBonds(m), "sum"),
    "arring": ("Aromatic rings",   None,  lambda m: rdMolDescriptors.CalcNumAromaticRings(m),  "sum"),
}

# How the aggregate is labelled in the UI (Σ for sum, mean for average)
AGG_PREFIX = {"sum": "Σ", "mean": "mean"}


def compute_for_smiles(smiles):
    """Return {key: value} for a single SMILES, or None if it won't parse."""
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    out = {}
    for key, (_label, _unit, fn, _agg) in DESCRIPTORS.items():
        try:
            v = fn(mol)
            out[key] = round(float(v), 3)
        except Exception:
            out[key] = None
    return out


def aggregate(values_per_ligand):
    """values_per_ligand: list of per-ligand descriptor dicts. Returns aggregate dict."""
    agg = {}
    for key, (_label, _unit, _fn, mode) in DESCRIPTORS.items():
        vals = [d[key] for d in values_per_ligand if d and d.get(key) is not None]
        if not vals:
            agg[f"lig_{key}"] = None
        elif mode == "sum":
            agg[f"lig_{key}"] = round(sum(vals), 3)
        else:  # mean
            agg[f"lig_{key}"] = round(sum(vals) / len(vals), 3)
    return agg


def descriptor_properties():
    """Property entries to register on the library (role: descriptor)."""
    props = []
    for key, (label, unit, _fn, mode) in DESCRIPTORS.items():
        props.append({
            "key": f"lig_{key}",
            "label": f"{AGG_PREFIX[mode]} ligand {label}",
            "unit": unit,
            "role": "descriptor",
            "group": "Descriptors (ligand-based)",
        })
    return props


def process_library(lib_path):
    with open(lib_path, encoding="utf-8") as f:
        lib = json.load(f)

    # 1. Per-building-block descriptors; build code->descriptors lookup per position
    bb_desc = {}  # pos_key -> code -> descriptor dict
    n_bb_ok = 0
    for pos_key, bbs in lib["building_blocks"].items():
        bb_desc[pos_key] = {}
        for bb in bbs:
            smi = bb.get("smiles")
            if smi:
                d = compute_for_smiles(smi)
                bb["descriptors"] = d
                if d:
                    bb_desc[pos_key][bb["code"]] = d
                    n_bb_ok += 1
            else:
                bb["descriptors"] = None

    # 2. Per-compound aggregates over organic ligands
    n_compounds = 0
    for c in lib["compounds"]:
        per_ligand = []
        for pos_key, code in c.get("blocks", {}).items():
            d = bb_desc.get(pos_key, {}).get(code)
            if d:
                per_ligand.append(d)
        c["props"].update(aggregate(per_ligand))
        n_compounds += 1

    # 3. Register descriptor properties (replace any existing descriptor entries)
    existing = [p for p in lib["properties"] if p.get("role") != "descriptor"]
    lib["properties"] = existing + descriptor_properties()

    with open(lib_path, "w", encoding="utf-8") as f:
        json.dump(lib, f, ensure_ascii=False, separators=(",", ":"))

    print(f"  {lib['id']}: {n_bb_ok} BB descriptor sets, {n_compounds} compounds aggregated")
    print(f"  Wrote {lib_path}  ({lib_path.stat().st_size // 1024} KB)")


def main():
    parser = argparse.ArgumentParser(description="Compute ligand descriptors for library JSONs")
    parser.add_argument("data_dir", help="public/data directory (containing libraries/)")
    parser.add_argument("--library-id", default=None, help="Process only this library (default: all)")
    args = parser.parse_args()

    lib_dir = Path(args.data_dir) / "libraries"
    if not lib_dir.is_dir():
        sys.exit(f"No libraries/ dir under {args.data_dir}")

    if args.library_id:
        paths = [lib_dir / f"{args.library_id}.json"]
    else:
        paths = sorted(lib_dir.glob("*.json"))

    for p in paths:
        if not p.exists():
            print(f"  Skipping missing {p}")
            continue
        print(f"Processing {p.name} ...")
        process_library(p)
    print("Done.")


if __name__ == "__main__":
    main()
