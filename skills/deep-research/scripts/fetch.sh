#!/usr/bin/env bash
# fetch.sh - fetch a URL as clean markdown, with content-hash caching.
#
# First tries Jina Reader (https://r.jina.ai/<url>), which extracts main
# content as markdown without an API key. Falls back to raw curl if Jina
# is unreachable or returns empty.
#
# Cache directory:
#   $PI_RESEARCH_CACHE if set, otherwise ./research/cache
# Cache key:
#   sha256 of canonicalized URL (utm_*, fbclid, gclid stripped; trailing
#   slash and trailing ?/& removed).
#
# Usage:
#   fetch.sh <url>
#
# Output: markdown to stdout (with leading "# Source: <url>" header).
# Exit: 0 on success, 3 on fetch failure.

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <url>" >&2
  exit 64
fi

url="$1"
cache_dir="${PI_RESEARCH_CACHE:-./research/cache}"
mkdir -p "$cache_dir"

canonical=$(printf '%s' "$url" \
  | sed -E 's/[?&](utm_[^=]+|fbclid|gclid|mc_cid|mc_eid)=[^&]*//g; s/[?&]+$//; s|/+$||')
hash=$(printf '%s' "$canonical" | shasum -a 256 | cut -d' ' -f1)
out="$cache_dir/${hash}.md"

if [[ -s "$out" ]]; then
  cat "$out"
  exit 0
fi

ua="Mozilla/5.0 (compatible; pi-deep-research/0.1)"

# Jina Reader: returns clean markdown for most pages, no key needed.
if content=$(curl -fsSL --max-time 30 -A "$ua" \
      "https://r.jina.ai/${canonical}" 2>/dev/null) && [[ -n "$content" ]]; then
  {
    printf '# Source: %s\n\n' "$canonical"
    printf '%s\n' "$content"
  } | tee "$out"
  exit 0
fi

# Fallback: raw fetch. The agent will need to read the HTML if it gets here.
if raw=$(curl -fsSL --max-time 30 -A "$ua" "$canonical" 2>/dev/null); then
  {
    printf '# Source: %s\n\n' "$canonical"
    printf '> Note: Jina Reader unavailable; raw response follows.\n\n'
    printf '```\n%s\n```\n' "$raw"
  } | tee "$out"
  exit 0
fi

echo "error: failed to fetch $canonical" >&2
exit 3
