#!/usr/bin/env bash
# Notify IndexNow (Bing, Yandex, Naver, Seznam...) about changed pages.
#   bash .github/indexnow/submit.sh all              -> every URL in sitemap.xml
#   bash .github/indexnow/submit.sh changed BASE HEAD -> pages changed between two commits
set -euo pipefail

HOST="trymetaclear.com"
SITE="https://$HOST"
KEY="6831ac659025417a8ad68257b35efd89"
KEY_LOCATION="$SITE/$KEY.txt"
# Pages that must never be submitted (hidden or not real pages)
EXCLUDE_RE='^(404\.html|remove-gemini-ai-watermark\.html)$'

# Map a repo file path to its public URL (Netlify pretty URLs)
to_url() {
  local f="$1"
  case "$f" in
    index.html)        echo "$SITE/" ;;
    */index.html)      echo "$SITE/${f%index.html}" ;;
    *.html)            echo "$SITE/${f%.html}" ;;
  esac
}

mode="${1:-all}"
urls=()
if [ "$mode" = "all" ]; then
  while read -r u; do urls+=("$u"); done < <(grep -o '<loc>[^<]*</loc>' sitemap.xml | sed 's/<loc>//; s/<\/loc>//')
else
  base="$2"; head="$3"
  while read -r f; do
    [ -z "$f" ] && continue
    [[ "$f" =~ $EXCLUDE_RE ]] && continue
    u=$(to_url "$f"); [ -n "$u" ] && urls+=("$u")
  done < <(git diff --name-only --diff-filter=ACMR "$base" "$head" -- '*.html')
fi

if [ "${#urls[@]}" -eq 0 ]; then
  echo "No page URLs changed; nothing to submit."
  exit 0
fi

json_list=$(printf '"%s",' "${urls[@]}"); json_list="[${json_list%,}]"
body=$(printf '{"host":"%s","key":"%s","keyLocation":"%s","urlList":%s}' "$HOST" "$KEY" "$KEY_LOCATION" "$json_list")

echo "Submitting ${#urls[@]} URL(s) to IndexNow:"; printf '  %s\n' "${urls[@]}"
code=$(curl -s -o /tmp/indexnow.out -w '%{http_code}' -X POST "https://api.indexnow.org/indexnow" \
       -H "Content-Type: application/json; charset=utf-8" --data "$body")
echo "IndexNow response: HTTP $code $(cat /tmp/indexnow.out 2>/dev/null)"
# 200 = accepted, 202 = accepted (key validation pending)
case "$code" in 200|202) exit 0 ;; *) exit 1 ;; esac
