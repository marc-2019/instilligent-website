#!/usr/bin/env bash
# Production smoke tests for instilligent.com (Cloudflare Pages, static site).
#
# Modeled after BossBoard's production-smoke.spec.ts. Born from the 2026-04-13
# BossBoard incident: a deploy looked healthy but was actually broken because
# tests only verified rendering, not real production responses.
#
# This is a static site with no API, no auth, no JS-rendered content — so a
# bash + curl smoke test is the right tool. Adding Playwright for four
# page-load checks would be overkill on a site with no dev dependencies.
#
# Run with:
#     bash e2e/production-smoke.sh
#     PROD_URL=https://instilligent.pages.dev bash e2e/production-smoke.sh
#
# Should be wired into Cloudflare Pages post-deploy + a weekly cron.
# Exits non-zero on any failure so CI can fail the deploy.

set -uo pipefail

PROD_URL="${PROD_URL:-https://instilligent.com}"
TIMEOUT="${TIMEOUT:-10}"

PASS=0
FAIL=0
FAILURES=()

assert_status() {
    local path="$1"
    local expected="$2"
    local description="$3"

    local url="${PROD_URL}${path}"
    local actual
    actual=$(curl -sLI --max-time "$TIMEOUT" -o /dev/null -w "%{http_code}" "$url")

    if [[ "$actual" == "$expected" ]]; then
        echo "  PASS  $description ($url -> $actual)"
        PASS=$((PASS + 1))
    else
        echo "  FAIL  $description ($url -> $actual, expected $expected)"
        FAIL=$((FAIL + 1))
        FAILURES+=("$description: $url returned $actual, expected $expected")
    fi
}

assert_body_contains() {
    local path="$1"
    local needle="$2"
    local description="$3"

    local url="${PROD_URL}${path}"
    local body
    body=$(curl -sL --max-time "$TIMEOUT" "$url")

    if echo "$body" | grep -qiF "$needle"; then
        echo "  PASS  $description ($url contains '$needle')"
        PASS=$((PASS + 1))
    else
        echo "  FAIL  $description ($url missing '$needle')"
        FAIL=$((FAIL + 1))
        FAILURES+=("$description: $url body does not contain '$needle'")
    fi
}

assert_content_type() {
    local path="$1"
    local needle="$2"
    local description="$3"

    local url="${PROD_URL}${path}"
    local ct
    ct=$(curl -sLI --max-time "$TIMEOUT" -o /dev/null -w "%{content_type}" "$url")

    if echo "$ct" | grep -qiF "$needle"; then
        echo "  PASS  $description ($url -> $ct)"
        PASS=$((PASS + 1))
    else
        echo "  FAIL  $description ($url -> $ct, expected to contain '$needle')"
        FAIL=$((FAIL + 1))
        FAILURES+=("$description: $url content-type '$ct' missing '$needle'")
    fi
}

echo "Instilligent production smoke @ $PROD_URL"
echo "----------------------------------------"

# Pages should serve as HTML, 200 OK
assert_status "/" 200 "home page loads"
assert_status "/pages/about" 200 "about page loads"
assert_status "/pages/services" 200 "services page loads"
assert_status "/pages/privacy" 200 "privacy page loads"

# Critical static assets
assert_status "/css/style.css" 200 "main stylesheet loads"
assert_status "/sitemap.xml" 200 "sitemap is published"
assert_status "/robots.txt" 200 "robots.txt is published"

# Content sanity — landing page actually renders the brand,
# not a Cloudflare Pages "site not found" placeholder
assert_body_contains "/" "Instilligent" "home page contains brand"
assert_body_contains "/" "AI" "home page contains AI positioning copy"

# Content type sanity — not an HTML 502 from a misconfigured edge worker
assert_content_type "/" "text/html" "home page served as HTML"

echo "----------------------------------------"
echo "Results: $PASS passed, $FAIL failed"

if (( FAIL > 0 )); then
    echo
    echo "Failures:"
    for f in "${FAILURES[@]}"; do
        echo "  - $f"
    done
    exit 1
fi

exit 0
