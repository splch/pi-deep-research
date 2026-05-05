#!/usr/bin/env bash
# search.sh - provider-agnostic web search.
#
# Picks the first available provider via env var:
#   TAVILY_API_KEY > BRAVE_API_KEY > EXA_API_KEY
#
# Output: JSON array of {title, url, snippet} on stdout.
# Errors: written to stderr with non-zero exit.
#
# Usage:
#   search.sh "query string" [num_results]
#
# Examples:
#   search.sh "ion trap qubits coherence time" 10
#   search.sh "site:arxiv.org variational quantum eigensolver" 5

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 \"query\" [num_results]" >&2
  exit 64
fi

query="$1"
n="${2:-10}"

if ! command -v jq >/dev/null 2>&1; then
  echo "error: jq is required (brew install jq)" >&2
  exit 69
fi

if [[ -n "${TAVILY_API_KEY:-}" ]]; then
  # Tavily: POST with Bearer auth. search_depth=advanced gives richer snippets
  # (2 credits/call vs 1 for basic). max_results capped at 20 by the API.
  body=$(jq -nc --arg q "$query" --argjson n "$n" \
    '{query:$q, max_results:$n, search_depth:"advanced", include_answer:false}')
  curl -fsSL --max-time 30 -X POST https://api.tavily.com/search \
    -H "Authorization: Bearer ${TAVILY_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$body" \
  | jq '[.results[]? | {title, url, snippet: (.content // "")}]'
elif [[ -n "${BRAVE_API_KEY:-}" ]]; then
  # Brave: GET. count capped at 20.
  q_enc=$(jq -nr --arg q "$query" '$q | @uri')
  curl -fsSL --max-time 30 \
    "https://api.search.brave.com/res/v1/web/search?count=${n}&q=${q_enc}" \
    -H "X-Subscription-Token: ${BRAVE_API_KEY}" \
    -H "Accept: application/json" \
  | jq '[.web.results[]? | {title, url, snippet: (.description // "")}]'
elif [[ -n "${EXA_API_KEY:-}" ]]; then
  # Exa: text/summary are NOT returned unless requested via `contents`.
  # We cap text at ~1000 chars for snippet parity with Tavily/Brave;
  # the agent can call fetch.sh for full page content.
  body=$(jq -nc --arg q "$query" --argjson n "$n" \
    '{query:$q, numResults:$n, type:"auto", contents:{text:{maxCharacters:1000}}}')
  curl -fsSL --max-time 30 -X POST https://api.exa.ai/search \
    -H "x-api-key: ${EXA_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$body" \
  | jq '[.results[]? | {title, url, snippet: (.text // .summary // "")}]'
else
  echo "error: set one of TAVILY_API_KEY, BRAVE_API_KEY, EXA_API_KEY" >&2
  exit 78
fi
