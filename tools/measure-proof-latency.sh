#!/usr/bin/env bash
# tools/measure-proof-latency.sh
# Single unattended command that produces the proveBacking latency number.
# Copies example-bboard's known-working bboard-cli into a scratch dir OUTSIDE
# this repo, swaps in creva-zk's backing.compact, compiles it, and times one
# circuit call. Exits non-zero on any failure. Takes no input once started.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REF="${BBOARD_REF:-/root/midnight-refs/example-bboard}"
SCRATCH="${SCRATCH_DIR:-/tmp/creva-latency-harness}"

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
fail() { printf '\n\033[1;31mFAILED: %s\033[0m\n' "$1" >&2; exit 1; }

step "Checking prerequisites"
[ -d "$REF/bboard-cli" ] || fail "example-bboard not found at $REF (override with BBOARD_REF=/path)"
command -v docker >/dev/null || fail "docker not on PATH"
docker info >/dev/null 2>&1 || fail "docker daemon is not running"
command -v compact >/dev/null || fail "compact not on PATH"
[ -f "$REPO/contract/src/backing.compact" ] || fail "missing $REPO/contract/src/backing.compact"
echo "  reference : $REF"
echo "  scratch   : $SCRATCH"
echo "  devtools  : $(compact --version 2>/dev/null || echo unknown)"
echo "  compactc  : $(compact compile --version 2>/dev/null || compactc --version 2>/dev/null || echo unknown)"

step "Copying bboard-cli harness to scratch (outside the repo)"
rm -rf "$SCRATCH"
mkdir -p "$(dirname "$SCRATCH")"
cp -R "$REF" "$SCRATCH"
rm -rf "$SCRATCH/.git"

step "Swapping in creva-zk's circuit"
# Our circuit replaces theirs at the same path, so contract/package.json's
# `compact compile src/bboard.compact ./src/managed/bboard` needs no edit.
cp "$REPO/contract/src/backing.compact" "$SCRATCH/contract/src/bboard.compact"
cp "$REPO/tools/harness/witnesses.ts" "$SCRATCH/contract/src/witnesses.ts"
cp "$REPO/tools/harness/latency.ts" "$SCRATCH/bboard-cli/src/latency.ts"

step "Installing harness dependencies"
( cd "$SCRATCH" && npm install --no-audit --no-fund ) || fail "npm install failed"

step "Compiling backing.compact"
( cd "$SCRATCH/contract" && npm run compact ) || fail "compact compile failed"
[ -f "$SCRATCH/contract/src/managed/bboard/keys/proveBacking.prover" ] \
  || fail "compile produced no proveBacking prover key"

step "Running the measurement (deploy + one timed proveBacking call)"
cd "$SCRATCH/bboard-cli"
# transpile-only: example-bboard's own api/src/*.ts still references the
# bulletin-board ledger fields our circuit does not have. Those files are not
# on latency.ts's import path, but tsc would still typecheck them.
TS_NODE_TRANSPILE_ONLY=true \
  node --experimental-specifier-resolution=node --loader ts-node/esm src/latency.ts
