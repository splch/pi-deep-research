#!/usr/bin/env bash
# url-check.sh - verify every URL in a markdown file resolves.
#
# Extracts http(s) URLs, runs HEAD (then GET fallback) against each, prints
# OK / DEAD lines with line numbers. With --fix, attempts to rewrite each
# DEAD URL to its closest archive.org Wayback snapshot in place.
#
# Usage:
#   url-check.sh <markdown-file>
#   url-check.sh <markdown-file> --fix
#
# Exit codes:
#   0 - no dead URLs (or all dead URLs were fixed)
#   1 - one or more dead URLs remain
#   64 - usage error

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <markdown-file> [--fix]" >&2
  exit 64
fi

file="$1"
fix="${2:-}"

if [[ ! -f "$file" ]]; then
  echo "error: file not found: $file" >&2
  exit 64
fi

ua="Mozilla/5.0 (compatible; pi-deep-research/0.1)"

# Extract URLs with their first-seen line number.
urls=$(awk '
  {
    s = $0
    while (match(s, /https?:\/\/[^[:space:])"<>\]]+/)) {
      u = substr(s, RSTART, RLENGTH)
      gsub(/[.,;:!?\)\]]+$/, "", u)
      if (!(u in seen)) {
        seen[u] = NR
        print NR "\t" u
      }
      s = substr(s, RSTART + RLENGTH)
    }
  }
' "$file")

if [[ -z "$urls" ]]; then
  echo "no URLs found in $file" >&2
  exit 0
fi

dead_count=0
fixed_count=0

while IFS=$'\t' read -r line url; do
  [[ -z "$url" ]] && continue
  code=$(curl -sIL -o /dev/null -w "%{http_code}" --max-time 10 \
    -A "$ua" "$url" 2>/dev/null || echo "000")
  if [[ ! "$code" =~ ^(2..|3..)$ ]]; then
    # HEAD can be blocked; try a tiny GET before declaring dead.
    code=$(curl -sL -o /dev/null -w "%{http_code}" --max-time 10 \
      -A "$ua" --range 0-0 "$url" 2>/dev/null || echo "000")
  fi

  if [[ "$code" =~ ^(2..|3..)$ ]]; then
    printf 'OK\tline=%s\thttp=%s\t%s\n' "$line" "$code" "$url"
    continue
  fi

  printf 'DEAD\tline=%s\thttp=%s\t%s\n' "$line" "$code" "$url"
  dead_count=$((dead_count + 1))

  if [[ "$fix" != "--fix" ]]; then
    continue
  fi

  # Look up nearest archive.org snapshot.
  snapshot=$(curl -fsSL --max-time 10 \
    "https://archive.org/wayback/available?url=$(jq -nr --arg u "$url" '$u | @uri')" \
    | jq -r '.archived_snapshots.closest.url // empty' 2>/dev/null || true)

  if [[ -z "$snapshot" ]]; then
    printf 'NO-SNAPSHOT\tline=%s\t%s\n' "$line" "$url"
    continue
  fi

  # In-place rewrite (portable across macOS/GNU sed via .bak).
  esc_url=$(printf '%s' "$url" | sed -e 's/[\/&]/\\&/g')
  esc_snap=$(printf '%s' "$snapshot" | sed -e 's/[\/&]/\\&/g')
  sed -i.bak "s|${esc_url}|${esc_snap}|g" "$file"
  rm -f "${file}.bak"
  printf 'FIXED\tline=%s\t%s -> %s\n' "$line" "$url" "$snapshot"
  fixed_count=$((fixed_count + 1))
done <<< "$urls"

remaining=$((dead_count - fixed_count))

echo ""
if [[ $dead_count -eq 0 ]]; then
  echo "all URLs resolved"
  exit 0
fi

echo "summary: ${dead_count} dead, ${fixed_count} fixed via Wayback, ${remaining} unresolved" >&2
if [[ $remaining -gt 0 ]]; then
  if [[ "$fix" != "--fix" ]]; then
    echo "rerun with --fix to attempt Wayback Machine rewrites" >&2
  fi
  exit 1
fi
exit 0
