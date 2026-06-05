#!/bin/bash
set -e

DIFF=$(git diff --cached --diff-filter=ACMR)

if [ -z "$DIFF" ]; then
  exit 0
fi

ADDED=$(echo "$DIFF" | grep -E '^\+[^+]' || true)

if [ -z "$ADDED" ]; then
  exit 0
fi

PATTERNS=(
  'catch\s*\(\s*[_a-zA-Z0-9]*\s*\)\s*\{\s*$'
  'catch\s*\{[^}]*return\s+(null|undefined|false|0|\{\}|\[\])'
  '\|\|\s*[0-9]+'
  '\?\?\s*(noop|null|undefined|\{\}|0|""|'\''\'\''|\[\])'
  'return\s+(null|undefined)\s*;?\s*$'
)

FOUND=0
for pattern in "${PATTERNS[@]}"; do
  MATCHES=$(echo "$ADDED" | grep -E "$pattern" | head -5 || true)
  if [ -n "$MATCHES" ]; then
    if [ "$FOUND" -eq 0 ]; then
      echo "[detect-fallback] Potential fallback patterns detected in staged changes:"
      FOUND=1
    fi
    echo ""
    echo "Pattern: $pattern"
    echo "$MATCHES"
  fi
done

if [ "$FOUND" -eq 1 ]; then
  echo ""
  echo "[detect-fallback] Project policy forbids fallback mechanisms. See CLAUDE.md and docs/fallback-audit.md"
  exit 1
fi
