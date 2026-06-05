#!/bin/bash
set -e

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

echo "[pre-commit] Running checks..."

./scripts/block-secrets.sh
./scripts/detect-fallback.sh

echo "[pre-commit] Type checking agent..."
pnpm exec tsc --noEmit

echo "[pre-commit] Type checking frontend..."
pnpm exec tsc -p tsconfig.frontend.json --noEmit

echo "[pre-commit] All checks passed."
