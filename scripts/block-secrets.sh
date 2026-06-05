#!/bin/bash
set -e

STAGED=$(git diff --cached --name-only --diff-filter=ACMR)

if [ -z "$STAGED" ]; then
  exit 0
fi

BLOCKED_EXTENSIONS='\.(env|key|pem|secret|p12|pfx)$'

echo "$STAGED" | while read -r file; do
  if echo "$file" | grep -qE "$BLOCKED_EXTENSIONS"; then
    echo "[block-secrets] Blocked: attempted to commit sensitive file '$file'"
    exit 1
  fi
done

scan_file() {
  local file="$1"
  local content
  content=$(git show ":$file" 2>/dev/null || true)
  if [ -z "$content" ]; then
    return 0
  fi

  local match
  match=$(echo "$content" | grep -nE "(sk-[a-zA-Z0-9]{20,}|pk-[a-zA-Z0-9]{20,}|api[_-]?key[[:space:]]*[:=][[:space:]]*[a-zA-Z0-9/+=\"']*[a-zA-Z0-9/+=]{16,}|password[[:space:]]*[:=][[:space:]]*[a-zA-Z0-9/+=\"']+[^[:space:]]{8,}|secret[[:space:]]*[:=][[:space:]]*[a-zA-Z0-9/+=\"']*[a-zA-Z0-9/+=]{16,}|ANTHROPIC_API_KEY|OPENAI_API_KEY)" | head -5 || true)

  if [ -n "$match" ]; then
    echo "[block-secrets] Potential secret in '$file':"
    echo "$match"
    return 1
  fi
}

SCAN_FILES=$(echo "$STAGED" | grep -E '\.(ts|tsx|js|jsx|mjs|cjs|html|yaml|yml|json|md)$' || true)

if [ -z "$SCAN_FILES" ]; then
  exit 0
fi

echo "$SCAN_FILES" | while read -r file; do
  scan_file "$file" || exit 1
done
