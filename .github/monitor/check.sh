#!/usr/bin/env bash
# TryMetaClear uptime + function check.
# Run by .github/workflows/monitor.yml every 30 minutes. Exits non-zero if anything is broken,
# which makes the workflow fail and GitHub emails the repo owner.
#
# Each check is retried 3 times (20s apart) so a single network blip doesn't send an alert.
# Run locally from the repo root:  bash .github/monitor/check.sh

set -u
SITE="${MONITOR_SITE:-https://trymetaclear.com}"
API="${MONITOR_API:-https://api.trymetaclear.com}"
RETRY_DELAY="${MONITOR_RETRY_DELAY:-20}"
ORIGIN="https://trymetaclear.com"
IMG="$(dirname "$0")/test-image.png"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

FAILED=()
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"
echo "## TryMetaClear monitor — $(date -u '+%Y-%m-%d %H:%M UTC')" >> "$SUMMARY"
echo "" >> "$SUMMARY"
echo "| Check | Result | Detail |" >> "$SUMMARY"
echo "|---|---|---|" >> "$SUMMARY"

# run_check "Name" function — retries up to 3 times; the function sets $DETAIL
run_check() {
  local name="$1" fn="$2" attempt
  for attempt in 1 2 3; do
    DETAIL=""
    if "$fn"; then
      echo "PASS  $name  ($DETAIL)"
      echo "| $name | ✅ Pass | $DETAIL |" >> "$SUMMARY"
      return 0
    fi
    [ "$attempt" -lt 3 ] && sleep "$RETRY_DELAY"
  done
  echo "FAIL  $name  ($DETAIL)"
  echo "::error title=$name failed::$DETAIL"
  echo "| $name | ❌ FAIL | $DETAIL |" >> "$SUMMARY"
  FAILED+=("$name")
  return 0
}

check_homepage() {
  local code
  code=$(curl -s -m 30 -o "$TMP/home.html" -w '%{http_code}' "$SITE/?monitor=$RANDOM")
  if [ "$code" != "200" ]; then DETAIL="HTTP $code"; return 1; fi
  grep -q 'id="dropZone"' "$TMP/home.html" || { DETAIL="upload box missing from page"; return 1; }
  grep -q '/clean-download.js' "$TMP/home.html" || { DETAIL="download script not linked"; return 1; }
  DETAIL="HTTP 200, upload box present"
}

check_download_script() {
  local code
  code=$(curl -s -m 30 -o "$TMP/cd.js" -w '%{http_code}' "$SITE/clean-download.js?monitor=$RANDOM")
  if [ "$code" != "200" ]; then DETAIL="HTTP $code"; return 1; fi
  grep -q 'cleanAndDownload' "$TMP/cd.js" || { DETAIL="script loaded but cleanAndDownload missing"; return 1; }
  DETAIL="HTTP 200"
}

check_video_page() {
  local code
  code=$(curl -s -m 30 -o "$TMP/video.html" -w '%{http_code}' "$SITE/remove-video-ai-metadata?monitor=$RANDOM")
  if [ "$code" != "200" ]; then DETAIL="HTTP $code"; return 1; fi
  grep -q 'id="downloadBtn"' "$TMP/video.html" || { DETAIL="download button missing from page"; return 1; }
  DETAIL="HTTP 200"
}

check_cors() {
  local hdr
  hdr=$(curl -s -m 30 -o /dev/null -D - -X OPTIONS -H "Origin: $ORIGIN" \
        -H "Access-Control-Request-Method: POST" "$API/api/v1/scan" | tr -d '\r')
  echo "$hdr" | grep -qi "^access-control-allow-origin: \(\*\|$ORIGIN\)$" \
    || { DETAIL="API no longer allows requests from $ORIGIN (browsers will block uploads)"; return 1; }
  DETAIL="allows $ORIGIN"
}

check_scan() {
  local code fields
  code=$(curl -s -m 60 -o "$TMP/scan.json" -w '%{http_code}' -H "Origin: $ORIGIN" \
         -F "file=@$IMG;type=image/png" "$API/api/v1/scan")
  if [ "$code" != "200" ]; then DETAIL="HTTP $code"; return 1; fi
  grep -q '"sections"' "$TMP/scan.json" || { DETAIL="response has no metadata sections"; return 1; }
  fields=$(grep -o '"name":' "$TMP/scan.json" | wc -l | tr -d ' ')
  [ "$fields" -ge 3 ] || { DETAIL="only $fields metadata fields returned"; return 1; }
  DETAIL="HTTP 200, $fields fields"
}

check_clean() {
  local code size
  code=$(curl -s -m 60 -o "$TMP/clean.bin" -w '%{http_code}' -H "Origin: $ORIGIN" \
         -F "file=@$IMG;type=image/png" "$API/api/v1/clean")
  if [ "$code" != "200" ]; then DETAIL="HTTP $code"; return 1; fi
  size=$(wc -c < "$TMP/clean.bin" | tr -d ' ')
  [ "$size" -gt 100 ] || { DETAIL="returned file is only $size bytes"; return 1; }
  # A valid PNG starts with the bytes 89 50 4E 47 ("\x89PNG")
  [ "$(head -c 4 "$TMP/clean.bin" | od -An -tx1 | tr -d ' \n')" = "89504e47" ] \
    || { DETAIL="returned file is not a valid image"; return 1; }
  DETAIL="HTTP 200, valid PNG ($size bytes)"
}

run_check "Homepage loads"                 check_homepage
run_check "Download script loads"          check_download_script
run_check "Video page loads"               check_video_page
run_check "API allows site (CORS)"         check_cors
run_check "Scan (upload) works"            check_scan
run_check "Remove AI & Download works"     check_clean

echo ""
if [ "${#FAILED[@]}" -gt 0 ]; then
  echo "BROKEN: ${FAILED[*]}"
  printf '\n**Broken:** %s\n' "${FAILED[*]}" >> "$SUMMARY"
  exit 1
fi
echo "All checks passed."
printf '\nAll checks passed.\n' >> "$SUMMARY"
