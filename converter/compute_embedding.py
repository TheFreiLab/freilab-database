#!/usr/bin/env python3
"""
Frei Lab Compound Database — 2D chemical-space embedding (Stage 7b).

Post-processes the library JSONs produced by convert.py. Builds a per-compound
ELECTRUM fingerprint (Orsi & Frei, "ELECTRUM: an electron configuration-based
universal metal fingerprint for transition metal compounds", Digital Discovery,
2025, 4, 3567-3577, DOI: 10.1039/d5dd00145e) and projects it to 2D with UMAP,
writing coordinates back onto each compound as "umap": [x, y].

ELECTRUM fingerprint (vendored from github.com/TheFreiLab/electrum_val):
  - Each ligand SMILES contributes a folded fingerprint of radius-2 circular
    substructures (SHA1-hashed, modulo n_bits). Ligand fingerprints are summed
    bitwise, so repeated substructures (or repeated ligands) accumulate rather
    than just flip a bit on.
  - The coordinating metal's electron configuration (86-bit, one entry per
    element) is appended unchanged. Compounds with no metal (the free-ligand
    "Free_*" scaffolds) get an all-zero 86-bit block instead.
  - Final vector: 512 (ligand) + 86 (metal) = 598 dimensions per compound.

An earlier version of this script gave each metal scaffold a single one-hot
bit appended to a 2048-bit Morgan fingerprint. That signal (1 bit) was over
20x weaker than a typical ligand-driven difference, so compounds that were
identical apart from metal scaffold collapsed onto the same UMAP point (e.g.
all 7 non-free scaffolds of M16Y1 in TzLib landed on one pixel). ELECTRUM's
86-bit electron-configuration block gives the metal a proportionate share of
the vector instead of a token categorical flag.

Run AFTER convert.py (operates in place on the JSON files):
    python compute_embedding.py ../public/data
    python compute_embedding.py ../public/data --library-id TzLib
"""

import sys
import json
import argparse
import hashlib
from pathlib import Path

import numpy as np
from rdkit import Chem

N_BITS = 512
RADIUS = 2

# Electron-configuration vectors (86 bits each), vendored verbatim from
# metals_dict in github.com/TheFreiLab/electrum_val/electrum.py. Only the
# metals actually present in our libraries are included.
METALS_DICT = {
    'Ir': np.array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0]),
    'Re': np.array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0]),
    'Mn': np.array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    'Ru': np.array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
}
N_METAL_BITS = len(next(iter(METALS_DICT.values())))
NO_METAL = np.zeros(N_METAL_BITS, dtype=int)

# Library-specific knowledge: which building-block positions form the
# "ligand" SMILES, and how to resolve the coordinating metal per compound.
TZLIB_SCAFFOLD_METAL = {
    'IrCN': 'Ir',
    'Re_CO3': 'Re', 'Re_CO3_solv': 'Re',
    'Mn_CO3': 'Mn', 'Mn_CO3_solv': 'Mn',
    'RuCy_Tz4P': 'Ru', 'RuCy_Tz1MP': 'Ru',
    'Free_Tz4P': None, 'Free_Tz1MP': None,
}
NOSB_SCAFFOLD_METAL = {'IrCp': 'Ir', 'RuCy': 'Ru'}
LIBRARY_SPECS = {
    'IrCpSB': {
        'ligand_positions': ['Cp', 'Ald', 'Amine'],
        'metal_for': lambda blocks: 'Ir',
    },
    'TzLib': {
        'ligand_positions': ['Amine', 'Alkyne'],
        'metal_for': lambda blocks: TZLIB_SCAFFOLD_METAL[blocks['Scaffold']],
    },
    'NOSB': {
        'ligand_positions': ['Scaffold', 'Aldehyde', 'Amine'],
        'metal_for': lambda blocks: NOSB_SCAFFOLD_METAL[blocks['Scaffold']],
    },
}


def get_atom_env(mol, radius, atom):
    env = Chem.FindAtomEnvironmentOfRadiusN(mol, radius, atom)
    submol = Chem.PathToSubmol(mol, env, atomMap={})
    return Chem.MolToSmiles(submol, isomericSmiles=False, canonical=True)


def get_mol_substructs(mol, radius):
    substructs = []
    for r in range(1, radius + 1):
        for a in range(mol.GetNumAtoms()):
            substructs.append(get_atom_env(mol, r, a))
    return list(set(substructs))


def hash_and_fold(mol, radius, n_bits):
    fp = np.zeros(n_bits, dtype=int)
    for s in get_mol_substructs(mol, radius):
        fp[int(hashlib.sha1(s.encode('utf-8')).hexdigest(), 16) % n_bits] = 1
    return fp


def electrum_fingerprint(ligand_smiles, metal, radius, n_bits):
    """ligand_smiles: '.'-joined SMILES of the coordinating ligands. metal: element
    symbol, or None for a metal-free (free-ligand) compound."""
    mols = [Chem.MolFromSmiles(s, sanitize=False) for s in ligand_smiles.split('.')]
    ligand_fp = np.sum([hash_and_fold(m, radius, n_bits) for m in mols], axis=0)
    metal_vec = METALS_DICT[metal] if metal else NO_METAL
    return np.append(ligand_fp, metal_vec)


def process_library(lib_path):
    with open(lib_path, encoding="utf-8") as f:
        lib = json.load(f)

    spec = LIBRARY_SPECS.get(lib['id'])
    if spec is None:
        print(f"  No ELECTRUM spec for library '{lib['id']}', skipping.")
        return

    bb_smiles = {pos: {bb['code']: bb['smiles'] for bb in bbs}
                 for pos, bbs in lib['building_blocks'].items()}

    feats = []
    for c in lib['compounds']:
        blocks = c['blocks']
        ligand_smiles = '.'.join(
            bb_smiles[pos][blocks[pos]] for pos in spec['ligand_positions']
        )
        metal = spec['metal_for'](blocks)
        feats.append(electrum_fingerprint(ligand_smiles, metal, RADIUS, N_BITS))

    X = np.vstack(feats)
    print(f"  {lib['id']}: {X.shape[0]} compounds x {X.shape[1]} ELECTRUM features")

    import umap
    n_neighbors = min(15, max(2, X.shape[0] - 1))
    reducer = umap.UMAP(
        n_neighbors=n_neighbors,
        min_dist=0.1,
        metric="manhattan",
        random_state=42,
        n_components=2,
    )
    coords = reducer.fit_transform(X)

    mins = coords.min(axis=0)
    maxs = coords.max(axis=0)
    span = np.where(maxs - mins == 0, 1, maxs - mins)
    norm = (coords - mins) / span

    for c, xy in zip(lib['compounds'], norm):
        c["umap"] = [round(float(xy[0]), 4), round(float(xy[1]), 4)]

    with open(lib_path, "w", encoding="utf-8") as f:
        json.dump(lib, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  Wrote {lib_path}  ({lib_path.stat().st_size // 1024} KB)")


def main():
    parser = argparse.ArgumentParser(description="Compute ELECTRUM/UMAP embedding for library JSONs")
    parser.add_argument("data_dir", help="public/data directory (containing libraries/)")
    parser.add_argument("--library-id", default=None, help="Process only this library (default: all)")
    args = parser.parse_args()

    lib_dir = Path(args.data_dir) / "libraries"
    if not lib_dir.is_dir():
        sys.exit(f"No libraries/ dir under {args.data_dir}")

    paths = [lib_dir / f"{args.library_id}.json"] if args.library_id else sorted(lib_dir.glob("*.json"))
    for p in paths:
        if not p.exists():
            print(f"  Skipping missing {p}")
            continue
        print(f"Processing {p.name} ...")
        process_library(p)
    print("Done.")


if __name__ == "__main__":
    main()
